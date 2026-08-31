import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { getPersonnel, listAccessiblePersonnelBranches, listPersonnelUserOptions } from "@/modules/hr"
import { HrPersonnelForm } from "../../new/personnel-form"

function canUpdate(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_personnel", "update"))
  )
}

export default async function EditPersonnelPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const { id } = await params
  const roles = session.user.roles as UserRole[]
  if (!canUpdate(roles)) redirect(`/hr/personnel/${id}`)

  const companyId = session.user.companyId as string

  let row
  try {
    const result = await getPersonnel(prisma, { companyId, roles, id })
    row = result.data
  } catch {
    notFound()
  }

  const [{ data: branches }, { data: users }] = await Promise.all([
    listAccessiblePersonnelBranches(prisma, { companyId, roles }),
    listPersonnelUserOptions(prisma, { companyId, roles, currentUserId: row.userId }),
  ])

  const assignedIds = row.branchAssignments.map((a) => a.branchId)
  const primary = row.branchAssignments.find((a) => a.isPrimary)?.branchId ?? row.branchId

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href={`/hr/personnel/${row.id}`} className="text-sm text-blue-600 hover:underline">
          ← {row.displayName}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">แก้ไขบุคลากร</h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground">{row.rosterNo}</p>
      </div>
      <HrPersonnelForm
        mode="edit"
        personnelId={row.id}
        branches={branches}
        users={users}
        initial={{
          rosterNo: row.rosterNo,
          displayName: row.displayName,
          jobGroup: row.jobGroup,
          firstName: row.firstName,
          lastName: row.lastName,
          idCardNo: row.idCardNo,
          phone: row.phone,
          address: row.address,
          notes: row.notes,
          isActive: row.isActive,
          userId: row.userId,
          departmentId: row.departmentId,
          positionId: row.positionId,
          branchIds: assignedIds.length ? assignedIds : row.branchId ? [row.branchId] : [],
          primaryBranchId: primary,
        }}
      />
    </div>
  )
}
