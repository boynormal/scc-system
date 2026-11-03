import { getBranchIds, hasPermission, isAdminInAnyBranch, type Action, type UserRole } from "@/lib/permissions"

export function canReadHrPersonnel(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_personnel", "read"))
  )
}

export function canReadHrAttendance(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_attendance", "read"))
  )
}

export function canReadSettingsUsers(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "users", "read"))
  )
}

export function canReadSettingsBranches(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "branches", "read"))
  )
}

export function canReadSettingsRoles(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "roles", "read"))
  )
}

export function canReadSettingsMasterData(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "settings", "read"))
  )
}

export function canReadSettingsHomeScreen(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "settings", "read"))
  )
}

export function canUpdateSettingsBranchSharing(roles: UserRole[]) {
  return getBranchIds(roles).some((bid) => hasPermission(roles, bid, "settings", "update"))
}

/** Create or update a supplier. settings:update still grants both so older custom roles keep working. */
export function canWriteSupplier(roles: UserRole[], action: Extract<Action, "create" | "update">) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "suppliers", action)) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "settings", "update"))
  )
}

/** Matches DELETE /api/master-data/suppliers/:id — Admin, or an explicit settings delete. */
export function canDeleteSupplier(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "settings", "delete"))
  )
}
