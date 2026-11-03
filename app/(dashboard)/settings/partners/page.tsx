import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { canDeleteSupplier, canReadSettingsMasterData, canWriteSupplier } from "@/lib/hr-settings-nav-access"
import { PartnersManager } from "./partners-manager"

export const metadata: Metadata = { title: "คู่ค้าและหน่วยนับ" }

export default async function SettingsPartnersPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canReadSettingsMasterData(roles)) redirect("/")

  return (
    <PartnersManager
      canCreateSupplier={canWriteSupplier(roles, "create")}
      canUpdateSupplier={canWriteSupplier(roles, "update")}
      canDeleteSupplier={canDeleteSupplier(roles)}
    />
  )
}
