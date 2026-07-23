import { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { Card } from "@/components/ui/card"
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

  const branches = await prisma.branch.findMany({
    where: { companyId: session.user.companyId, isActive: true, deletedAt: null },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  })

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <Link href="/hr/personnel" className="text-sm text-blue-600 hover:underline">
          ← กลับ
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 mt-2">เพิ่มบุคลากร</h1>
        <p className="text-slate-500 text-sm mt-1">รหัสรายชื่อ (roster) ต้องไม่ซ้ำกับรายอื่นในบริษัท</p>
      </div>
      <Card padding="md">
        <HrPersonnelForm branches={branches} />
      </Card>
    </div>
  )
}
