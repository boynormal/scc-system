import { getBranchIds, hasPermission, type Action, type Resource, type UserRole } from "@/lib/permissions"
import {
  canAccessModuleId,
  getModuleAccessCatalogEntry,
} from "@/shared/permissions/module-access-catalog"
import type { ModuleNavNode } from "./moduleRegistry"

function canAccessResource(roles: UserRole[], resource: Resource, action: Action): boolean {
  for (const branchId of getBranchIds(roles)) {
    if (hasPermission(roles, branchId, resource, action)) return true
  }
  if (resource === "notifications" && action === "read") {
    for (const branchId of getBranchIds(roles)) {
      if (hasPermission(roles, branchId, "dashboard", "read")) return true
    }
  }
  return false
}

/** Group visibility from MODULE_ACCESS_CATALOG.anyOfResources when key matches a catalog moduleId */
function canSeeCatalogGroup(roles: UserRole[], catalogModuleId: string): boolean {
  const entry = getModuleAccessCatalogEntry(catalogModuleId)
  if (!entry) return false
  return entry.anyOfResources.some((resource) => canAccessResource(roles, resource, "read"))
}

function filterOne(
  n: ModuleNavNode,
  roles: UserRole[],
  userModuleAccess?: string[] | "all" | null
): ModuleNavNode | null {
  if (n.type === "link") {
    if (!canAccessResource(roles, n.permission.resource, n.permission.action)) return null
    if (n.moduleId && !canAccessModuleId(roles, n.moduleId, userModuleAccess)) return null
    return n
  }
  if (n.type === "group") {
    const children = n.children
      .map((c) => filterOne(c, roles, userModuleAccess))
      .filter((c): c is ModuleNavNode => c !== null)
    if (!children.length) return null
    const groupOk =
      n.key === "maintenance"
        ? canSeeCatalogGroup(roles, "maintenance")
        : canAccessResource(roles, n.permission.resource, n.permission.action)
    if (!groupOk) return null
    return { ...n, children }
  }
  if (n.type === "section") {
    const children = n.children
      .map((c) => filterOne(c, roles, userModuleAccess))
      .filter((c): c is ModuleNavNode => c !== null)
    if (!children.length) return null
    return { ...n, children }
  }
  return null
}

/**
 * กรองเมนูตาม RBAC แบบ recursive (section / group / link ซ้อน)
 * @param userModuleAccess override การมองเห็นโมดูลรายบุคคล (User.moduleAccess) —
 *   ไม่ระบุ/null = ไม่จำกัดชั้นโมดูล (โชว์ตามสิทธิ์ resource); ระบุแล้วค่อยจำกัดเพิ่ม
 *   รองรับทั้ง catalog moduleId (เช่น transport) และ nav moduleId (เช่น transport_jobs)
 */
export function filterNavByPermission(
  nodes: ModuleNavNode[],
  roles: UserRole[],
  userModuleAccess?: string[] | "all" | null
): ModuleNavNode[] {
  return nodes.map((n) => filterOne(n, roles, userModuleAccess)).filter((n): n is ModuleNavNode => n !== null)
}
