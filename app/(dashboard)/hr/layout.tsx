import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { UserRole } from "@/lib/permissions"
import { canEnterModuleArea } from "@/shared/permissions/module-access-catalog"
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
  }
  if (canReadHrAttendance(roles)) {
    tabs.push({ href: "/hr/attendance", label: "บันทึกเวลา" })
  }

  if (tabs.length === 0) {
    redirect("/")
  }

  return (
    <div>
      <HrModuleTabs tabs={tabs} />
      {children}
    </div>
  )
}
