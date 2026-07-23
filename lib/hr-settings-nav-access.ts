import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"

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
