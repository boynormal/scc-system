import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { UserRole } from "@/lib/permissions"
import {
  canReadSettingsBranches,
  canReadSettingsMasterData,
  canReadSettingsRoles,
  canReadSettingsUsers,
} from "@/lib/hr-settings-nav-access"

export default async function SettingsIndexPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]

  if (canReadSettingsUsers(roles)) redirect("/settings/users")
  if (canReadSettingsBranches(roles)) redirect("/settings/branches")
  if (canReadSettingsRoles(roles)) redirect("/settings/roles")
  if (canReadSettingsMasterData(roles)) redirect("/settings/master-data")
  redirect("/")
}
