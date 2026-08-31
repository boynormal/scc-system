import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { canReadSettingsMasterData } from "@/lib/hr-settings-nav-access"
import { OrganizationManager } from "./organization-manager"

export const metadata: Metadata = { title: "แผนก / ฝ่าย" }

export default async function SettingsOrganizationPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!canReadSettingsMasterData(session.user.roles as UserRole[])) redirect("/")

  return <OrganizationManager />
}
