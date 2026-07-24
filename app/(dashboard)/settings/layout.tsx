import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import type { UserRole } from "@/lib/permissions"
import { parseCompanyNavPreferences } from "@/shared/navigation/companyNavPreferences"
import { cn } from "@/lib/utils"
import {
  canReadSettingsHomeScreen,
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
  const tabs: SettingsTabDef[] = [{ href: "/settings", label: "ภาพรวม", icon: "overview", exact: true }]
  if (canReadSettingsUsers(roles)) {
    tabs.push({ href: "/settings/users", label: "ผู้ใช้งาน", icon: "users" })
  }
  if (canReadSettingsBranches(roles)) {
    tabs.push({ href: "/settings/branches", label: "สาขา", icon: "branches" })
  }
  if (canReadSettingsRoles(roles)) {
    tabs.push({ href: "/settings/roles", label: "สิทธิ์การใช้งาน", icon: "roles" })
  }
  if (canReadSettingsMasterData(roles)) {
    tabs.push({ href: "/settings/master-data", label: "ข้อมูลพื้นฐาน", icon: "master-data" })
  }
  if (canReadSettingsHomeScreen(roles)) {
    tabs.push({ href: "/settings/home-screen", label: "หน้าจอหลัก", icon: "home-screen" })
  }

  if (tabs.length <= 1) {
    redirect("/")
  }

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { settings: true },
  })
  const navPreferences = parseCompanyNavPreferences(company?.settings ?? null)
  const isDark = navPreferences.appearance === "dark"

  return (
    <div className={cn(isDark && "dark")}>
      <div className="-m-6 min-h-[calc(100vh-4rem)] p-6 dark:bg-slate-900">
        <SettingsModuleTabs tabs={tabs} />
        {children}
      </div>
    </div>
  )
}
