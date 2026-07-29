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
import { SettingsHub } from "./settings-hub"
import packageJson from "@/package.json"

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  const roles = session.user.roles as UserRole[]
  const access = {
    users: canReadSettingsUsers(roles),
    branches: canReadSettingsBranches(roles),
    roles: canReadSettingsRoles(roles),
    masterData: canReadSettingsMasterData(roles),
    homeScreen: canReadSettingsHomeScreen(roles),
  }

  if (!Object.values(access).some(Boolean)) {
    redirect("/")
  }

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { settings: true },
  })
  const navPreferences = parseCompanyNavPreferences(company?.settings ?? null)
  const isDark = navPreferences.appearance === "dark"
  const customIconCount =
    Object.keys(navPreferences.productLineImageOverrides).length +
    Object.keys(navPreferences.moduleImageOverrides).length

  return (
    <div className={cn(isDark && "dark")}>
      <div className="-m-6 min-h-[calc(100vh-4rem)] p-6 dark:bg-slate-900">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* ภาพรวมตั้งค่า — คอลัมน์ซ้ายเพียงอย่างเดียว */}
          <div className="w-full shrink-0 lg:sticky lg:top-6 lg:max-h-[calc(100vh-5rem)] lg:w-[22rem] lg:overflow-y-auto xl:w-[24rem]">
            <SettingsHub
              access={access}
              appearance={navPreferences.appearance}
              customIconCount={customIconCount}
              appVersion={packageJson.version}
            />
          </div>

          {/* รายการที่ขยายออก — คอลัมน์ขวา */}
          <div className="min-w-0 flex-1 rounded-2xl border border-border bg-white/70 p-4 text-foreground shadow-sm backdrop-blur-md dark:bg-slate-800/70 sm:p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
