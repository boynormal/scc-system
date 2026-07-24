export type Resource =
  | "dashboard"
  | "machines"
  | "maintenance_plans"
  | "schedules"
  | "work_orders"
  | "spare_parts"
  | "inventory"
  | "reports"
  | "users"
  | "roles"
  | "branches"
  | "settings"
  | "notifications"
  | "hr_personnel"
  | "hr_attendance"
  | "transport_jobs"
  | "transport_vehicles"
  | "transport_drivers"
  | "iot_devices"

export type Action = "create" | "read" | "update" | "delete" | "approve"

export type Permission = Partial<Record<Resource, Action[]>>

export interface UserRole {
  branchId: string
  branchName: string
  roleName: string
  permissions: Permission | null
}

/**
 * รวม default ระบบกับ JSON ที่เก็บในฐานข้อมูล: ค่าจาก DB ชนะ; คีย์ใดยังไม่เคยบันทึกใช้ default
 * (รองรับเวลาเพิ่ม Resource ใหม่ — ไม่ต้อง migrate JSON ทุก role ก็ยังใช้สิทธิ์ default ของชื่อ role นั้น)
 */
function mergeRolePermissions(roleName: string, stored: Permission | null | undefined): Permission {
  const defaults = DEFAULT_ROLE_PERMISSIONS[roleName]
  const s: Permission = { ...(stored ?? {}) }
  if (!defaults) return s
  for (const key of Object.keys(defaults) as (keyof Permission)[]) {
    if (s[key] === undefined && defaults[key] !== undefined) {
      s[key] = defaults[key]!
    }
  }
  return s
}

export function hasPermission(
  roles: UserRole[],
  branchId: string,
  resource: Resource,
  action: Action
): boolean {
  // Admin: ใช้สิทธิ์ของ Role Admin ได้ทุกสาขา (ไม่ต้องมี user_branch_roles ตรงกับ branchId ของทรัพยากร)
  if (isAdminInAnyBranch(roles)) {
    const adminRole = roles.find((r) => r.roleName === "Admin")
    if (adminRole) {
      const adminPerms = mergeRolePermissions("Admin", adminRole.permissions)
      const adminAllowed = adminPerms[resource]
      if (Array.isArray(adminAllowed) && adminAllowed.includes(action)) return true
    }
  }

  const branchRole = roles.find((r) => r.branchId === branchId)
  if (!branchRole) return false

  const effective = mergeRolePermissions(branchRole.roleName, branchRole.permissions)
  const allowed = effective[resource]
  return Array.isArray(allowed) && allowed.includes(action)
}

export function isAdminInBranch(roles: UserRole[], branchId: string): boolean {
  return roles.some((r) => r.branchId === branchId && r.roleName === "Admin")
}

export function isAdminInAnyBranch(roles: UserRole[]): boolean {
  return roles.some((r) => r.roleName === "Admin")
}

export function getBranchIds(roles: UserRole[]): string[] {
  return Array.from(new Set(roles.map((r) => r.branchId)))
}

/**
 * ตรวจสอบว่า user (จาก roles) มีสิทธิ์เข้าถึง moduleId ที่ระบุหรือไม่
 * Admin bypass ทุก module restriction
 * moduleAccess เก็บเป็น extra JSON field ใน Role.permissions — ไม่รบกวน Permission type
 * ถ้า role ไม่มี moduleAccess (undefined) = ไม่จำกัด (backward compat)
 */
/**
 * @param userModuleAccess override รายบุคคล (User.moduleAccess) — ถ้ากำหนด (ไม่ใช่ null/undefined)
 * จะใช้แทนค่าจาก Role ทั้งหมด (ไม่ intersect); ถ้าไม่กำหนด fallback ไปตรวจ moduleAccess ของแต่ละ Role ตามเดิม
 */
export function canAccessModule(
  roles: UserRole[],
  moduleId: string,
  userModuleAccess?: string[] | "all" | null
): boolean {
  if (isAdminInAnyBranch(roles)) return true

  if (userModuleAccess !== undefined && userModuleAccess !== null) {
    if (userModuleAccess === "all") return true
    return Array.isArray(userModuleAccess) && userModuleAccess.includes(moduleId)
  }

  return roles.some((role) => {
    const raw = role.permissions as (Permission & { moduleAccess?: string[] | "all" }) | null
    const ma = raw?.moduleAccess
    if (!ma || ma === "all") return true
    return Array.isArray(ma) && ma.includes(moduleId)
  })
}

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission> = {
  Admin: {
    dashboard: ["read"],
    machines: ["create", "read", "update", "delete"],
    maintenance_plans: ["create", "read", "update", "delete"],
    schedules: ["create", "read", "update", "delete"],
    work_orders: ["create", "read", "update", "delete", "approve"],
    spare_parts: ["create", "read", "update", "delete"],
    inventory: ["create", "read", "update", "delete"],
    reports: ["read"],
    users: ["create", "read", "update", "delete"],
    roles: ["create", "read", "update", "delete"],
    branches: ["create", "read", "update", "delete"],
    settings: ["read", "update"],
    notifications: ["read"],
    hr_personnel: ["create", "read", "update", "delete"],
    hr_attendance: ["create", "read", "update", "delete"],
    transport_jobs: ["create", "read", "update", "delete"],
    transport_vehicles: ["create", "read", "update", "delete"],
    transport_drivers: ["create", "read", "update", "delete"],
    iot_devices: ["read"],
  },
  Manager: {
    dashboard: ["read"],
    machines: ["create", "read", "update"],
    maintenance_plans: ["create", "read", "update"],
    schedules: ["read", "update"],
    work_orders: ["create", "read", "update", "approve"],
    spare_parts: ["read", "update"],
    inventory: ["read", "update"],
    reports: ["read"],
    users: ["read"],
    roles: ["read"],
    branches: ["read"],
    settings: ["read"],
    notifications: ["read"],
    hr_personnel: ["create", "read", "update"],
    hr_attendance: ["create", "read", "update"],
    transport_jobs: ["create", "read", "update"],
    transport_vehicles: ["read", "update"],
    transport_drivers: ["read", "update"],
    iot_devices: ["read"],
  },
  Technician: {
    dashboard: ["read"],
    machines: ["read"],
    maintenance_plans: ["read"],
    schedules: ["read"],
    work_orders: ["create", "read", "update"],
    spare_parts: ["read"],
    inventory: ["read", "update"],
    reports: ["read"],
    notifications: ["read"],
    hr_personnel: ["read"],
    hr_attendance: ["read"],
    transport_jobs: ["read"],
    transport_vehicles: ["read"],
    transport_drivers: ["read"],
    iot_devices: ["read"],
  },
  Viewer: {
    dashboard: ["read"],
    machines: ["read"],
    maintenance_plans: ["read"],
    schedules: ["read"],
    work_orders: ["read"],
    spare_parts: ["read"],
    inventory: ["read"],
    reports: ["read"],
    notifications: ["read"],
    hr_personnel: ["read"],
    hr_attendance: ["read"],
    transport_jobs: ["read"],
    transport_vehicles: ["read"],
    transport_drivers: ["read"],
  },
}
