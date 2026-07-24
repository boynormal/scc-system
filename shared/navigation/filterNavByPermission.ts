import { canAccessModule, getBranchIds, hasPermission, type Action, type Resource, type UserRole } from "@/lib/permissions"
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

/** กลุ่มซ่อมบำรุงมีลูกหลายสิทธิ์ (แดชบอร์ด / แผน / ตาราง / รายงาน) — แสดงกลุ่มเมื่อมีสิทธิ์อย่างใดอย่างหนึ่ง */
function canSeeMaintenanceGroup(roles: UserRole[]): boolean {
  return (
    canAccessResource(roles, "dashboard", "read") ||
    canAccessResource(roles, "maintenance_plans", "read") ||
    canAccessResource(roles, "schedules", "read") ||
    canAccessResource(roles, "reports", "read")
  )
}

function filterOne(
  n: ModuleNavNode,
  roles: UserRole[],
  userModuleAccess?: string[] | "all" | null
): ModuleNavNode | null {
  if (n.type === "link") {
    if (!canAccessResource(roles, n.permission.resource, n.permission.action)) return null
    if (n.moduleId && !canAccessModule(roles, n.moduleId, userModuleAccess)) return null
    return n
  }
  if (n.type === "group") {
    const children = n.children
      .map((c) => filterOne(c, roles, userModuleAccess))
      .filter((c): c is ModuleNavNode => c !== null)
    if (!children.length) return null
    const groupOk =
      n.key === "maintenance"
        ? canSeeMaintenanceGroup(roles)
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
 * @param userModuleAccess override การมองเห็นโมดูลรายบุคคล (User.moduleAccess) — ไม่ระบุ = ใช้ตาม Role
 */
export function filterNavByPermission(
  nodes: ModuleNavNode[],
  roles: UserRole[],
  userModuleAccess?: string[] | "all" | null
): ModuleNavNode[] {
  return nodes.map((n) => filterOne(n, roles, userModuleAccess)).filter((n): n is ModuleNavNode => n !== null)
}
