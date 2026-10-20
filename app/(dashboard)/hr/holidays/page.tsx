import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { canReadHrAttendance } from "@/lib/hr-settings-nav-access"
import { canAttendanceAnyBranch, listAttendanceBranches } from "@/modules/hr"
import { todayInZone } from "../attendance/attendance-format"
import { HolidayCalendar } from "./holiday-calendar"

export default async function HrHolidaysPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canReadHrAttendance(roles)) redirect("/hr/personnel")

  const companyId = session.user.companyId as string
  const branches = await listAttendanceBranches(prisma, { companyId, roles })

  return (
    <HolidayCalendar
      branches={branches}
      year={Number(todayInZone("Asia/Bangkok").slice(0, 4))}
      canUpdate={canAttendanceAnyBranch(roles, "update")}
    />
  )
}
