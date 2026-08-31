import { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { listAccessiblePersonnelBranches, listPersonnelUserOptions } from "@/modules/hr"
import { HrPersonnelForm } from "./personnel-form"

export const metadata: Metadata = { title: "เพิ่มบุคลากร" }

function canCreate(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_personnel", "create"))
  )
}

export default async function NewPersonnelPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canCreate(roles)) redirect("/hr/personnel")

  const companyId = session.user.companyId as string
  const [{ data: branches }, { data: users }] = await Promise.all([
    listAccessiblePersonnelBranches(prisma, { companyId, roles }),
    listPersonnelUserOptions(prisma, { companyId, roles }),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/hr/personnel" className="text-sm text-blue-600 hover:underline">
          ← บุคลากร
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">เพิ่มบุคลากร</h1>
        <p className="mt-1 text-sm text-muted-foreground">กรอกชื่อกับรหัสรายชื่อ เลือกสาขาที่ลงเวลาได้ แล้วบันทึก</p>
      </div>
      <HrPersonnelForm branches={branches} users={users} />
    </div>
  )
}
