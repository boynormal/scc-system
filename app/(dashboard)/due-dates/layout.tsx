import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { UserRole } from "@/lib/permissions"
import { canEnterModuleArea } from "@/shared/permissions/module-access-catalog"

export default async function DueDatesLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  const roles = session.user.roles as UserRole[]
  if (!canEnterModuleArea(roles, "due_dates", session.user.moduleAccess)) redirect("/")

  return <div className="min-w-0">{children}</div>
}
