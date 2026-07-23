import type { UserRole } from "@/lib/permissions"
import { MODULE_NAV_REGISTRY, type ModuleNavNode } from "./moduleRegistry"
import { DEPARTMENT_BY_ID } from "./departmentRegistry"
import {
  applyCompanyNavOverrides,
  sortNavTree,
  type CompanyNavPreferences,
} from "./companyNavPreferences"
import { filterNavByPermission } from "./filterNavByPermission"

function collectModuleIds(nodes: ModuleNavNode[], out: string[] = []): string[] {
  for (const n of nodes) {
    if (n.type === "link" || n.type === "group") {
      out.push(n.moduleId)
    }
    if (n.type === "group" || n.type === "section") {
      collectModuleIds(n.children, out)
    }
  }
  return out
}

function assertUniqueModuleIds(nodes: ModuleNavNode[]) {
  const ids = collectModuleIds(nodes)
  const seen = new Set<string>()
  const dup: string[] = []
  for (const id of ids) {
    if (seen.has(id)) dup.push(id)
    seen.add(id)
  }
  if (dup.length > 0) {
    const values = Array.from(new Set(dup)).join(", ")
    console.warn(`[nav] duplicate moduleId in registry: ${values}`)
  }
}

function assertLauncherDepartments(nodes: ModuleNavNode[]) {
  const unknown = new Set<string>()
  const visit = (list: ModuleNavNode[]) => {
    for (const n of list) {
      if (n.type === "link" || n.type === "group") {
        const id = n.launcher?.departmentId
        if (id && !DEPARTMENT_BY_ID[id]) unknown.add(id)
      }
      if (n.type === "group" || n.type === "section") visit(n.children)
    }
  }
  visit(nodes)
  if (unknown.size > 0) {
    console.warn(`[nav] unknown launcher departmentId: ${Array.from(unknown).join(", ")}`)
  }
}

/**
 * pipeline: registry → tenant overrides → sort → RBAC
 * เรียกได้ทั้ง server (layout) และ client
 */
export function buildDashboardNav(
  roles: UserRole[],
  prefs: CompanyNavPreferences
): ModuleNavNode[] {
  assertUniqueModuleIds(MODULE_NAV_REGISTRY)
  assertLauncherDepartments(MODULE_NAV_REGISTRY)
  let nodes: ModuleNavNode[] = MODULE_NAV_REGISTRY
  nodes = applyCompanyNavOverrides(nodes, prefs)
  nodes = sortNavTree(nodes, prefs.orderOverrides)
  if (roles.length > 0) {
    nodes = filterNavByPermission(nodes, roles)
  }
  return nodes
}
