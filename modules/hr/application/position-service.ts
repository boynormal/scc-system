import { z } from "zod"
import type { Prisma, PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"

/** ความลึกของสายบังคับบัญชาที่ยอมให้มีได้ — กันผังลึกเกินอ่านและกันวงกลมโดยพลาด */
export const MAX_POSITION_DEPTH = 10

export type PositionAuditMeta = {
  ipAddress?: string | null
  userAgent?: string | null
}

type PositionAuditEvent =
  | "POSITION_CREATE"
  | "POSITION_UPDATE"
  | "POSITION_MOVE"
  | "POSITION_DEACTIVATE"
  | "POSITION_DELETE"

const nullableUuid = z
  .union([z.string().uuid(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null))

const nullableText = (max: number) =>
  z
    .union([z.string().max(max), z.literal(""), z.null()])
    .optional()
    .transform((v) => {
      const t = typeof v === "string" ? v.trim() : ""
      return t ? t : null
    })

const positionFieldsSchema = z.object({
  name: z.string().min(1).max(255),
  code: nullableText(20),
  parentId: nullableUuid,
  departmentId: nullableUuid,
  headcount: z.number().int().min(0).max(9999).optional(),
  sortOrder: z.number().int().min(-9999).max(9999).optional(),
  responsibilities: nullableText(5000),
})

export const createPositionSchema = positionFieldsSchema.extend({
  branchId: z.string().uuid(),
})

/** branchId แก้ไม่ได้หลังสร้าง — ย้ายสาขาจะทำให้ parent และคนที่นั่งอยู่ไม่ valid */
export const updatePositionSchema = positionFieldsSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export type CreatePositionInput = z.infer<typeof createPositionSchema>
export type UpdatePositionInput = z.infer<typeof updatePositionSchema>

export type PositionRow = {
  id: string
  branchId: string
  parentId: string | null
  departmentId: string | null
  department: { id: string; name: string; code: string | null } | null
  code: string | null
  name: string
  sortOrder: number
  headcount: number
  responsibilities: string | null
  isActive: boolean
  /** คนที่นั่งอยู่จริง — นับเฉพาะบุคลากรที่ยังใช้งานและไม่ถูกลบ */
  occupantCount: number
  vacancy: number
}

export type PositionTreeNode = PositionRow & {
  depth: number
  children: PositionTreeNode[]
}

export type PositionOption = {
  id: string
  name: string
  code: string | null
  parentId: string | null
  depth: number
}

/**
 * อ่านผังตำแหน่งได้ถ้าอ่านตำแหน่งหรืออ่านบุคลากรได้ — ฟอร์มบุคลากรกับผังองค์กรต้องใช้ตัวเลือกนี้
 */
export function canReadPositions(roles: UserRole[]): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some(
      (bid) =>
        hasPermission(roles, bid, "hr_positions", "read") ||
        hasPermission(roles, bid, "hr_personnel", "read")
    )
  )
}

function canWritePositions(roles: UserRole[], action: "create" | "update" | "delete"): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_positions", action))
  )
}

export function canCreatePositions(roles: UserRole[]): boolean {
  return canWritePositions(roles, "create")
}

export function canUpdatePositions(roles: UserRole[]): boolean {
  return canWritePositions(roles, "update")
}

export function canDeletePositions(roles: UserRole[]): boolean {
  return canWritePositions(roles, "delete")
}

function assertBranchPermission(
  roles: UserRole[],
  branchId: string,
  action: "create" | "read" | "update" | "delete"
) {
  if (isAdminInAnyBranch(roles)) return
  if (action === "read") {
    if (
      hasPermission(roles, branchId, "hr_positions", "read") ||
      hasPermission(roles, branchId, "hr_personnel", "read")
    ) {
      return
    }
  } else if (hasPermission(roles, branchId, "hr_positions", action)) {
    return
  }
  throw new ForbiddenError("ไม่มีสิทธิ์ในสาขาที่เลือก")
}

async function loadBranch(db: PrismaClient, companyId: string, branchId: string) {
  const parsed = z.string().uuid().safeParse(branchId)
  if (!parsed.success) throw new ValidationError("สาขาไม่ถูกต้อง")
  const branch = await db.branch.findFirst({
    where: { id: parsed.data, companyId, deletedAt: null, isActive: true },
    select: { id: true, code: true, name: true },
  })
  if (!branch) throw new ValidationError("สาขาไม่ถูกต้อง")
  return branch
}

async function writePositionAudit(
  db: { auditLog: { create: PrismaClient["auditLog"]["create"] } },
  params: {
    userId?: string | null
    recordId: string
    action: "create" | "update" | "delete"
    event: PositionAuditEvent
    branchId: string
    oldValues?: Record<string, unknown>
    newValues?: Record<string, unknown>
    audit?: PositionAuditMeta
  }
) {
  await db.auditLog.create({
    data: {
      userId: params.userId ?? null,
      tableName: "positions",
      recordId: params.recordId,
      action: params.action,
      oldValues: (params.oldValues ?? undefined) as Prisma.InputJsonValue | undefined,
      newValues: {
        event: params.event,
        branchId: params.branchId,
        ...(params.newValues ?? {}),
      } as Prisma.InputJsonValue,
      ipAddress: params.audit?.ipAddress ?? null,
      userAgent: params.audit?.userAgent ?? null,
    },
  })
}

type GraphRow = { id: string; parentId: string | null }

function childrenByParent(rows: GraphRow[]): Map<string | null, string[]> {
  const map = new Map<string | null, string[]>()
  for (const row of rows) {
    const list = map.get(row.parentId)
    if (list) list.push(row.id)
    else map.set(row.parentId, [row.id])
  }
  return map
}

/** ไล่จาก startId ขึ้นไปถึง root — ผลลัพธ์รวม startId เอง และหยุดเองเมื่อเจอวงกลม */
function ancestorIds(rows: GraphRow[], startId: string): string[] {
  const parentOf = new Map(rows.map((r) => [r.id, r.parentId]))
  const chain: string[] = []
  const seen = new Set<string>()
  let cursor: string | null = startId
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor)
    chain.push(cursor)
    cursor = parentOf.get(cursor) ?? null
  }
  return chain
}

function subtreeHeight(rows: GraphRow[], rootId: string): number {
  const children = childrenByParent(rows)
  let height = 1
  let level = [rootId]
  const seen = new Set(level)
  while (level.length > 0) {
    const next: string[] = []
    for (const id of level) {
      for (const childId of children.get(id) ?? []) {
        if (seen.has(childId)) continue
        seen.add(childId)
        next.push(childId)
      }
    }
    if (next.length === 0) break
    height += 1
    level = next
  }
  return height
}

async function loadBranchGraph(db: PrismaClient, branchId: string): Promise<GraphRow[]> {
  return db.position.findMany({
    where: { branchId },
    select: { id: true, parentId: true },
  })
}

async function assertParentAllowed(
  db: PrismaClient,
  params: { branchId: string; parentId: string; movingId?: string }
) {
  if (params.movingId && params.movingId === params.parentId) {
    throw new ValidationError("ตำแหน่งเป็นหัวหน้าของตัวเองไม่ได้")
  }
  const parent = await db.position.findFirst({
    where: { id: params.parentId },
    select: { id: true, branchId: true, isActive: true },
  })
  if (!parent) throw new ValidationError("ตำแหน่งหัวหน้าไม่ถูกต้อง")
  if (parent.branchId !== params.branchId) {
    throw new ValidationError("ตำแหน่งหัวหน้าต้องอยู่สาขาเดียวกัน")
  }

  const graph = await loadBranchGraph(db, params.branchId)
  const chain = ancestorIds(graph, params.parentId)
  if (params.movingId && chain.includes(params.movingId)) {
    throw new ValidationError("ย้ายแล้วสายบังคับบัญชาจะวนกลับมาที่ตัวเอง")
  }
  const height = params.movingId ? subtreeHeight(graph, params.movingId) : 1
  if (chain.length + height > MAX_POSITION_DEPTH) {
    throw new ValidationError(`สายบังคับบัญชาลึกเกิน ${MAX_POSITION_DEPTH} ชั้น`)
  }
}

async function assertDepartmentAllowed(
  db: PrismaClient,
  params: { companyId: string; branchId: string; departmentId: string }
) {
  const dept = await db.department.findFirst({
    where: {
      id: params.departmentId,
      isActive: true,
      branch: { companyId: params.companyId, deletedAt: null },
    },
    select: { id: true, branchId: true },
  })
  if (!dept) throw new ValidationError("แผนกไม่ถูกต้อง")
  if (dept.branchId !== params.branchId) {
    throw new ValidationError("แผนกต้องอยู่สาขาเดียวกับตำแหน่ง")
  }
}

async function assertCodeFree(
  db: PrismaClient,
  params: { branchId: string; code: string; excludeId?: string }
) {
  const clash = await db.position.findFirst({
    where: {
      branchId: params.branchId,
      code: params.code,
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
    },
    select: { id: true },
  })
  if (clash) throw new ValidationError("รหัสตำแหน่งซ้ำในสาขานี้")
}

const positionSelect = {
  id: true,
  branchId: true,
  parentId: true,
  departmentId: true,
  code: true,
  name: true,
  sortOrder: true,
  headcount: true,
  responsibilities: true,
  isActive: true,
  department: { select: { id: true, name: true, code: true } },
} satisfies Prisma.PositionSelect

type RawPosition = {
  id: string
  branchId: string
  parentId: string | null
  departmentId: string | null
  code: string | null
  name: string
  sortOrder: number
  headcount: number
  responsibilities: string | null
  isActive: boolean
  department: { id: string; name: string; code: string | null } | null
}

function toRow(raw: RawPosition, occupantCount: number): PositionRow {
  return {
    id: raw.id,
    branchId: raw.branchId,
    parentId: raw.parentId,
    departmentId: raw.departmentId,
    department: raw.department,
    code: raw.code,
    name: raw.name,
    sortOrder: raw.sortOrder,
    headcount: raw.headcount,
    responsibilities: raw.responsibilities,
    isActive: raw.isActive,
    occupantCount,
    vacancy: Math.max(0, raw.headcount - occupantCount),
  }
}

function compareRows(a: PositionRow, b: PositionRow): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  const byName = a.name.localeCompare(b.name, "th")
  if (byName !== 0) return byName
  return a.id.localeCompare(b.id)
}

/**
 * ประกอบต้นไม้จากรายการแบน กิ่งที่ parent ไม่อยู่ในชุด (เช่น parent ถูกกรองออก)
 * จะเลื่อนขึ้นเป็น root เพื่อไม่ให้ข้อมูลหาย
 */
export function buildPositionTree(rows: PositionRow[]): PositionTreeNode[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const childIds = new Map<string, string[]>()
  const rootRows: PositionRow[] = []

  for (const row of rows) {
    const parentId = row.parentId
    if (parentId && parentId !== row.id && byId.has(parentId)) {
      const list = childIds.get(parentId)
      if (list) list.push(row.id)
      else childIds.set(parentId, [row.id])
    } else {
      rootRows.push(row)
    }
  }

  const visited = new Set<string>()
  const build = (row: PositionRow, depth: number): PositionTreeNode => {
    visited.add(row.id)
    const childRows = (childIds.get(row.id) ?? [])
      .filter((id) => !visited.has(id))
      .map((id) => byId.get(id)!)
    // จองไว้ก่อนลงลูก กันกรณีข้อมูลวนกลับมาหาตัวเอง
    for (const child of childRows) visited.add(child.id)
    childRows.sort(compareRows)
    return { ...row, depth, children: childRows.map((child) => build(child, depth + 1)) }
  }

  rootRows.sort(compareRows)
  const roots = rootRows.map((row) => build(row, 0))

  // แถวที่ติดอยู่ในวงกลมจะไม่เคยเป็น root — ยกขึ้นมาเพื่อไม่ให้ข้อมูลหายจากผัง
  const trapped = rows.filter((row) => !visited.has(row.id))
  trapped.sort(compareRows)
  for (const row of trapped) {
    if (visited.has(row.id)) continue
    roots.push(build(row, 0))
  }

  return roots
}

export function flattenPositionTree(nodes: PositionTreeNode[]): PositionTreeNode[] {
  const out: PositionTreeNode[] = []
  const walk = (list: PositionTreeNode[]) => {
    for (const node of list) {
      out.push(node)
      walk(node.children)
    }
  }
  walk(nodes)
  return out
}

async function occupantCounts(
  db: PrismaClient,
  params: { companyId: string; positionIds: string[] }
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (params.positionIds.length === 0) return counts
  const rows = await db.personnel.findMany({
    where: {
      companyId: params.companyId,
      deletedAt: null,
      isActive: true,
      positionId: { in: params.positionIds },
    },
    select: { positionId: true },
  })
  for (const row of rows) {
    if (!row.positionId) continue
    counts.set(row.positionId, (counts.get(row.positionId) ?? 0) + 1)
  }
  return counts
}

export async function listPositions(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    branchId: string
    includeInactive?: boolean
  }
): Promise<{
  data: {
    branch: { id: string; code: string; name: string }
    tree: PositionTreeNode[]
    totals: { positions: number; headcount: number; occupied: number; vacancy: number }
  }
}> {
  if (!canReadPositions(params.roles)) throw new ForbiddenError()
  const branch = await loadBranch(db, params.companyId, params.branchId)
  assertBranchPermission(params.roles, branch.id, "read")

  const raw = (await db.position.findMany({
    where: {
      branchId: branch.id,
      ...(params.includeInactive ? {} : { isActive: true }),
    },
    select: positionSelect,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })) as RawPosition[]

  const counts = await occupantCounts(db, {
    companyId: params.companyId,
    positionIds: raw.map((r) => r.id),
  })
  const rows = raw.map((r) => toRow(r, counts.get(r.id) ?? 0))

  return {
    data: {
      branch,
      tree: buildPositionTree(rows),
      totals: {
        positions: rows.length,
        headcount: rows.reduce((sum, r) => sum + r.headcount, 0),
        occupied: rows.reduce((sum, r) => sum + r.occupantCount, 0),
        vacancy: rows.reduce((sum, r) => sum + r.vacancy, 0),
      },
    },
  }
}

export async function listPositionOptions(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; branchId: string }
): Promise<{ data: PositionOption[] }> {
  const { data } = await listPositions(db, { ...params, includeInactive: false })
  return {
    data: flattenPositionTree(data.tree).map((node) => ({
      id: node.id,
      name: node.name,
      code: node.code,
      parentId: node.parentId,
      depth: node.depth,
    })),
  }
}

export async function getPosition(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
): Promise<{ data: PositionRow & { parent: { id: string; name: string } | null } }> {
  if (!canReadPositions(params.roles)) throw new ForbiddenError()
  const raw = (await db.position.findFirst({
    where: { id: params.id, branch: { companyId: params.companyId, deletedAt: null } },
    select: { ...positionSelect, parent: { select: { id: true, name: true } } },
  })) as (RawPosition & { parent: { id: string; name: string } | null }) | null
  if (!raw) throw new NotFoundError("ไม่พบตำแหน่ง")
  assertBranchPermission(params.roles, raw.branchId, "read")

  const counts = await occupantCounts(db, {
    companyId: params.companyId,
    positionIds: [raw.id],
  })
  return { data: { ...toRow(raw, counts.get(raw.id) ?? 0), parent: raw.parent } }
}

export async function createPosition(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId?: string | null
    input: CreatePositionInput
    audit?: PositionAuditMeta
  }
): Promise<{ data: PositionRow }> {
  if (!canCreatePositions(params.roles)) throw new ForbiddenError()
  const branch = await loadBranch(db, params.companyId, params.input.branchId)
  assertBranchPermission(params.roles, branch.id, "create")

  const input = params.input
  if (input.parentId) {
    await assertParentAllowed(db, { branchId: branch.id, parentId: input.parentId })
  }
  if (input.departmentId) {
    await assertDepartmentAllowed(db, {
      companyId: params.companyId,
      branchId: branch.id,
      departmentId: input.departmentId,
    })
  }
  if (input.code) {
    await assertCodeFree(db, { branchId: branch.id, code: input.code })
  }

  const raw = (await db.position.create({
    data: {
      branchId: branch.id,
      parentId: input.parentId,
      departmentId: input.departmentId,
      code: input.code,
      name: input.name.trim(),
      headcount: input.headcount ?? 1,
      sortOrder: input.sortOrder ?? 0,
      responsibilities: input.responsibilities,
    },
    select: positionSelect,
  })) as RawPosition

  await writePositionAudit(db, {
    userId: params.userId,
    recordId: raw.id,
    action: "create",
    event: "POSITION_CREATE",
    branchId: branch.id,
    newValues: {
      name: raw.name,
      code: raw.code,
      parentId: raw.parentId,
      departmentId: raw.departmentId,
      headcount: raw.headcount,
    },
    audit: params.audit,
  })

  return { data: toRow(raw, 0) }
}

export async function updatePosition(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId?: string | null
    id: string
    input: UpdatePositionInput
    audit?: PositionAuditMeta
  }
): Promise<{ data: PositionRow }> {
  if (!canUpdatePositions(params.roles)) throw new ForbiddenError()

  const existing = await db.position.findFirst({
    where: { id: params.id, branch: { companyId: params.companyId, deletedAt: null } },
    select: {
      id: true,
      branchId: true,
      parentId: true,
      departmentId: true,
      code: true,
      name: true,
      headcount: true,
      sortOrder: true,
      isActive: true,
    },
  })
  if (!existing) throw new NotFoundError("ไม่พบตำแหน่ง")
  assertBranchPermission(params.roles, existing.branchId, "update")

  const input = params.input
  const parentChanged = input.parentId !== undefined && input.parentId !== existing.parentId
  if (parentChanged && input.parentId) {
    await assertParentAllowed(db, {
      branchId: existing.branchId,
      parentId: input.parentId,
      movingId: existing.id,
    })
  }
  if (input.departmentId !== undefined && input.departmentId) {
    await assertDepartmentAllowed(db, {
      companyId: params.companyId,
      branchId: existing.branchId,
      departmentId: input.departmentId,
    })
  }
  if (input.code !== undefined && input.code) {
    await assertCodeFree(db, {
      branchId: existing.branchId,
      code: input.code,
      excludeId: existing.id,
    })
  }

  const data: Prisma.PositionUpdateInput = {}
  if (input.name !== undefined) data.name = input.name.trim()
  if (input.code !== undefined) data.code = input.code
  if (input.parentId !== undefined) {
    data.parent = input.parentId ? { connect: { id: input.parentId } } : { disconnect: true }
  }
  if (input.departmentId !== undefined) {
    data.department = input.departmentId
      ? { connect: { id: input.departmentId } }
      : { disconnect: true }
  }
  if (input.headcount !== undefined) data.headcount = input.headcount
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder
  if (input.responsibilities !== undefined) data.responsibilities = input.responsibilities
  if (input.isActive !== undefined) data.isActive = input.isActive

  const raw = (await db.position.update({
    where: { id: existing.id },
    data,
    select: positionSelect,
  })) as RawPosition

  await writePositionAudit(db, {
    userId: params.userId,
    recordId: existing.id,
    action: "update",
    event: parentChanged ? "POSITION_MOVE" : "POSITION_UPDATE",
    branchId: existing.branchId,
    oldValues: {
      name: existing.name,
      code: existing.code,
      parentId: existing.parentId,
      departmentId: existing.departmentId,
      headcount: existing.headcount,
      isActive: existing.isActive,
    },
    newValues: {
      name: raw.name,
      code: raw.code,
      parentId: raw.parentId,
      departmentId: raw.departmentId,
      headcount: raw.headcount,
      isActive: raw.isActive,
    },
    audit: params.audit,
  })

  const counts = await occupantCounts(db, {
    companyId: params.companyId,
    positionIds: [raw.id],
  })
  return { data: toRow(raw, counts.get(raw.id) ?? 0) }
}

/**
 * ลบได้เฉพาะตำแหน่งที่ไม่มีลูกและไม่มีคนเคยผูกไว้ (นับแถวที่ soft-delete ด้วย
 * เหมือน delete-guard ของแผนก) นอกนั้นปิดใช้งานเพื่อไม่ให้ประวัติขาด
 */
export async function deletePosition(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId?: string | null
    id: string
    audit?: PositionAuditMeta
  }
): Promise<{ data: { id: string; deactivated: boolean } }> {
  if (!canDeletePositions(params.roles)) throw new ForbiddenError()

  const existing = await db.position.findFirst({
    where: { id: params.id, branch: { companyId: params.companyId, deletedAt: null } },
    select: { id: true, branchId: true, name: true, isActive: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบตำแหน่ง")
  assertBranchPermission(params.roles, existing.branchId, "delete")

  const [childCount, personnelCount] = await Promise.all([
    db.position.count({ where: { parentId: existing.id } }),
    db.personnel.count({ where: { positionId: existing.id } }),
  ])

  if (childCount > 0 || personnelCount > 0) {
    await db.position.update({ where: { id: existing.id }, data: { isActive: false } })
    await writePositionAudit(db, {
      userId: params.userId,
      recordId: existing.id,
      action: "update",
      event: "POSITION_DEACTIVATE",
      branchId: existing.branchId,
      oldValues: { name: existing.name, isActive: existing.isActive },
      newValues: { isActive: false, childCount, personnelCount },
      audit: params.audit,
    })
    return { data: { id: existing.id, deactivated: true } }
  }

  await db.position.delete({ where: { id: existing.id } })
  await writePositionAudit(db, {
    userId: params.userId,
    recordId: existing.id,
    action: "delete",
    event: "POSITION_DELETE",
    branchId: existing.branchId,
    oldValues: { name: existing.name },
    audit: params.audit,
  })
  return { data: { id: existing.id, deactivated: false } }
}
