import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { canReadSettingsMasterData } from "@/lib/hr-settings-nav-access"
import { MaintenanceMasterData } from "./maintenance-master-data"

export const metadata: Metadata = { title: "ข้อมูลพื้นฐานงานซ่อมบำรุง" }

export default async function MaintenanceMasterDataPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!canReadSettingsMasterData(session.user.roles as UserRole[])) redirect("/")

  return <MaintenanceMasterData />
}
