import { getBranchIds, hasPermission, isAdminInAnyBranch, type Action, type Resource, type UserRole } from "@/lib/permissions"

export const BRANCH_SHARE_MODULES = [
  "transport_jobs",
  "assets",
  "machines",
  "work_orders",
  "due_dates",
  "finance",
  "personnel",
] as const

export type BranchShareModule = (typeof BRANCH_SHARE_MODULES)[number]
export type BranchShareAction = "view" | "edit" | "delete" | "create" | "approve"

export type BranchShareFlags = {
  view: boolean
  edit: boolean
  delete: boolean
  create: boolean
  approve: boolean
}

export type BranchSharingSettings = Record<BranchShareModule, BranchShareFlags>

const MODULE_SET = new Set<string>(BRANCH_SHARE_MODULES)

function flags(partial: Partial<BranchShareFlags>): BranchShareFlags {
  return {
    view: partial.view ?? false,
    edit: partial.edit ?? false,
    delete: partial.delete ?? false,
    create: partial.create ?? false,
    approve: partial.approve ?? false,
  }
}

export function defaultBranchSharing(): BranchSharingSettings {
  return {
    transport_jobs: flags({ view: true, edit: true, create: true }),
    assets: flags({}),
    machines: flags({}),
    work_orders: flags({}),
    due_dates: flags({}),
    finance: flags({}),
    personnel: flags({}),
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

export function parseBranchSharing(settings: unknown): BranchSharingSettings {
  const defaults = defaultBranchSharing()
  const root = asRecord(settings)
  const raw = asRecord(root?.branchSharing)
  if (!raw) return defaults

  const next: BranchSharingSettings = { ...defaults }
  for (const moduleId of BRANCH_SHARE_MODULES) {
    const row = asRecord(raw[moduleId])
    if (!row) continue
    const base = defaults[moduleId]
    next[moduleId] = {
      view: boolOr(row.view, base.view),
      edit: boolOr(row.edit, base.edit),
      delete: boolOr(row.delete, base.delete),
      create: boolOr(row.create, base.create),
      approve: moduleId === "finance" ? boolOr(row.approve, false) : false,
    }
  }
  return next
}

export function isBranchShareModule(value: string): value is BranchShareModule {
  return MODULE_SET.has(value)
}

type CompanySettingsReader = {
  company?: {
    findUnique?: (args: {
      where: { id: string }
      select: { settings: true }
    }) => Promise<{ settings?: unknown } | null>
  }
}

export async function readBranchSharing(
  db: CompanySettingsReader,
  companyId: string
): Promise<BranchSharingSettings> {
  const findUnique = db.company?.findUnique
  if (typeof findUnique !== "function") return defaultBranchSharing()
  const company = await findUnique({
    where: { id: companyId },
    select: { settings: true },
  })
  return parseBranchSharing(company?.settings ?? null)
}

/**
 * A grant on any assigned branch covers `branchId` only when `shared` is on.
 * Admins keep their existing company-wide grant through `hasPermission`.
 */
export function permissionCoversBranch(
  roles: UserRole[],
  resource: Resource,
  action: Action,
  branchId: string,
  shared: boolean
): boolean {
  if (!shared) return hasPermission(roles, branchId, resource, action)
  if (isAdminInAnyBranch(roles)) return hasPermission(roles, branchId, resource, action)
  return getBranchIds(roles).some((id) => hasPermission(roles, id, resource, action))
}
