import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import type { UserRole } from "@/lib/permissions"
import { parseCompanyNavPreferences } from "@/shared/navigation/companyNavPreferences"
import {
  canReadSettingsBranches,
  canReadSettingsHomeScreen,
  canReadSettingsMasterData,
  canReadSettingsRoles,
  canReadSettingsUsers,
} from "@/lib/hr-settings-nav-access"
import { SettingsHub } from "./settings-hub"
import packageJson from "@/package.json"

export default async function SettingsIndexPage() {
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
  const customIconCount = Object.keys(navPreferences.productLineImageOverrides).length

  return (
    <SettingsHub
      access={access}
      appearance={navPreferences.appearance}
      customIconCount={customIconCount}
      appVersion={packageJson.version}
    />
  )
}
