import {
  getBranchIds,
  hasPermission,
  isAdminInAnyBranch,
  type Resource,
  type UserRole,
} from "@/lib/permissions"

export type ModuleAccessCatalogEntry = {
  /** Product-area id used by layouts / coarse gates (e.g. transport, hr) */
  moduleId: string
  label: string
  /** Enter area if user has read on any of these resources */
  anyOfResources: Resource[]
  /** Nav `moduleId` values that belong to this area (User override matching) */
  navModuleIds: string[]
}

/**
 * Single source for module-area ↔ resource(s) used by layouts and override matching.
 * Per-link nav gates still live on MODULE_NAV_REGISTRY nodes.
 */
export const MODULE_ACCESS_CATALOG: ModuleAccessCatalogEntry[] = [
  {
    moduleId: "machines",
    label: "เครื่องจักร",
    anyOfResources: ["machines"],
    navModuleIds: ["machines"],
  },
  {
    moduleId: "maintenance",
    label: "การซ่อมบำรุง",
    anyOfResources: ["dashboard", "maintenance_plans", "schedules", "reports"],
    navModuleIds: ["maintenance", "dashboard", "reports"],
  },
  {
    moduleId: "work_orders",
    label: "ใบสั่งงาน",
    anyOfResources: ["work_orders"],
    navModuleIds: ["work_orders"],
  },
  {
    moduleId: "spare_parts",
    label: "อะไหล่",
    anyOfResources: ["spare_parts"],
    navModuleIds: ["spare_parts"],
  },
  {
    moduleId: "notifications",
    label: "การแจ้งเตือน",
    anyOfResources: ["notifications"],
    navModuleIds: ["notifications"],
  },
  {
    moduleId: "hr",
    label: "บุคลากร",
    anyOfResources: ["hr_personnel", "hr_attendance"],
    navModuleIds: ["hr_personnel", "hr_attendance"],
  },
  {
    moduleId: "transport",
    label: "ขนส่ง",
    anyOfResources: ["transport_jobs", "transport_vehicles", "transport_drivers"],
    navModuleIds: [
      "transport_dashboard",
      "transport_jobs",
      "transport_calendar",
      "transport_map",
      "transport_monitor",
      "transport_repairs",
      "transport_tires",
      "transport_master_data",
    ],
  },
  {
    moduleId: "iot",
    label: "ควบคุม IoT",
    anyOfResources: ["iot_devices"],
    navModuleIds: ["iot_control", "iot_queue_ticket", "iot_barrier_gate", "iot_metal_detector"],
  },
  {
    moduleId: "settings",
    label: "ตั้งค่า",
    anyOfResources: ["settings", "users", "roles", "branches"],
    navModuleIds: ["settings"],
  },
]

export function getModuleAccessCatalogEntry(moduleId: string): ModuleAccessCatalogEntry | undefined {
  return MODULE_ACCESS_CATALOG.find((e) => e.moduleId === moduleId)
}

function canReadResource(roles: UserRole[], resource: Resource): boolean {
  if (isAdminInAnyBranch(roles)) return true
  for (const branchId of getBranchIds(roles)) {
    if (hasPermission(roles, branchId, resource, "read")) return true
  }
  if (resource === "notifications") {
    for (const branchId of getBranchIds(roles)) {
      if (hasPermission(roles, branchId, "dashboard", "read")) return true
    }
  }
  return false
}

/** True when the user has read on any resource mapped to this product area. */
export function hasModuleAreaResourceRead(roles: UserRole[], moduleId: string): boolean {
  const entry = getModuleAccessCatalogEntry(moduleId)
  if (!entry) return false
  return entry.anyOfResources.some((resource) => canReadResource(roles, resource))
}

/**
 * Nav-link visibility under User.moduleAccess override.
 * - No override / "all" → unrestricted at this layer
 * - Exact nav moduleId match
 * - Coarse catalog area in override unlocks all of its navModuleIds
 */
export function canAccessModuleId(
  roles: UserRole[],
  moduleId: string,
  userModuleAccess?: string[] | "all" | null
): boolean {
  if (isAdminInAnyBranch(roles)) return true

  if (userModuleAccess === undefined || userModuleAccess === null) return true
  if (userModuleAccess === "all") return true
  if (!Array.isArray(userModuleAccess)) return false

  if (userModuleAccess.includes(moduleId)) return true

  for (const entry of MODULE_ACCESS_CATALOG) {
    if (userModuleAccess.includes(entry.moduleId) && entry.navModuleIds.includes(moduleId)) {
      return true
    }
  }

  return false
}

function canAccessModuleAreaOverride(
  roles: UserRole[],
  areaModuleId: string,
  userModuleAccess?: string[] | "all" | null
): boolean {
  if (isAdminInAnyBranch(roles)) return true

  if (userModuleAccess === undefined || userModuleAccess === null) return true
  if (userModuleAccess === "all") return true
  if (!Array.isArray(userModuleAccess)) return false

  if (userModuleAccess.includes(areaModuleId)) return true

  const entry = getModuleAccessCatalogEntry(areaModuleId)
  if (!entry) return false
  return entry.navModuleIds.some((id) => userModuleAccess.includes(id))
}

/** Layout / area entry: User override (coarse or any fine nav id) + at least one mapped resource read. */
export function canEnterModuleArea(
  roles: UserRole[],
  moduleId: string,
  userModuleAccess?: string[] | "all" | null
): boolean {
  return (
    canAccessModuleAreaOverride(roles, moduleId, userModuleAccess) &&
    hasModuleAreaResourceRead(roles, moduleId)
  )
}
