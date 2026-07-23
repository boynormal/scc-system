import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { UserRole } from "@/lib/permissions"
import { canReadHrAttendance, canReadHrPersonnel } from "@/lib/hr-settings-nav-access"

export default async function HrIndexPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]

  if (canReadHrPersonnel(roles)) redirect("/hr/personnel")
  if (canReadHrAttendance(roles)) redirect("/hr/attendance")
  redirect("/")
}
