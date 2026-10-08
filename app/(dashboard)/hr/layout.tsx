import { cookies } from "next/headers"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { UserRole } from "@/lib/permissions"
import { APPEARANCE_COOKIE, resolveAppearance } from "@/shared/appearance"
import { canEnterModuleArea } from "@/shared/permissions/module-access-catalog"
import { ModuleBackdrop } from "@/components/shell/module-backdrop"
import {
  canManageHrPositions,
  canReadHrAttendance,
  canReadHrPersonnel,
} from "@/lib/hr-settings-nav-access"
import { HrModuleTabs, type HrTabDef } from "./hr-module-tabs"

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  const roles = session.user.roles as UserRole[]
  if (!canEnterModuleArea(roles, "hr", session.user.moduleAccess)) redirect("/")

  const tabs: HrTabDef[] = []
  if (canReadHrPersonnel(roles)) {
    tabs.push({ href: "/hr/personnel", label: "ข้อมูลบุคลากร" })
    tabs.push({ href: "/hr/org", label: "ผังองค์กร" })
  }
  if (canManageHrPositions(roles)) {
    tabs.push({ href: "/hr/positions", label: "ตำแหน่ง" })
    tabs.push({ href: "/hr/duties", label: "สมุดหน้าที่" })
  }
  if (canReadHrAttendance(roles)) {
    tabs.push({ href: "/hr/attendance", label: "บันทึกเวลา" })
  }

  if (tabs.length === 0) {
    redirect("/")
  }

  const cookieStore = await cookies()
  const isDark = resolveAppearance(cookieStore.get(APPEARANCE_COOKIE)?.value) === "dark"

  return (
    <ModuleBackdrop isDark={isDark}>
      <div className="space-y-6">
        <HrModuleTabs tabs={tabs} />
        {children}
      </div>
    </ModuleBackdrop>
  )
}
