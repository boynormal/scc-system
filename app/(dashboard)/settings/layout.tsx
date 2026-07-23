import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { UserRole } from "@/lib/permissions"
import {
  canReadSettingsBranches,
  canReadSettingsMasterData,
  canReadSettingsRoles,
  canReadSettingsUsers,
} from "@/lib/hr-settings-nav-access"
import { SettingsModuleTabs, type SettingsTabDef } from "./settings-module-tabs"

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  const roles = session.user.roles as UserRole[]
  const tabs: SettingsTabDef[] = []
  if (canReadSettingsUsers(roles)) {
    tabs.push({ href: "/settings/users", label: "ผู้ใช้งาน" })
  }
  if (canReadSettingsBranches(roles)) {
    tabs.push({ href: "/settings/branches", label: "สาขา" })
  }
  if (canReadSettingsRoles(roles)) {
    tabs.push({ href: "/settings/roles", label: "สิทธิ์การใช้งาน" })
  }
  if (canReadSettingsMasterData(roles)) {
    tabs.push({ href: "/settings/master-data", label: "ข้อมูลพื้นฐาน" })
  }

  if (tabs.length === 0) {
    redirect("/")
  }

  return (
    <div>
      <SettingsModuleTabs tabs={tabs} />
      {children}
    </div>
  )
}
