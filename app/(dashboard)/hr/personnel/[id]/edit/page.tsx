import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { getPersonnel, listAccessiblePersonnelBranches, listPersonnelDepartments } from "@/modules/hr"
import { HrPersonnelForm } from "../../new/personnel-form"
import { personnelDateTimeInput } from "@/modules/hr/application/personnel-date-time"

function dateInput(value: Date | null): string | null {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

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

  const [{ data: branches }, { data: departments }] = await Promise.all([
    listAccessiblePersonnelBranches(prisma, { companyId, roles }),
    listPersonnelDepartments(prisma, { companyId, roles }),
  ])

  const primary = row.branchAssignments.find((a) => a.isPrimary)?.branchId ?? row.branchId

  return (
    <div className="mx-auto max-w-2xl space-y-6">
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
        departments={departments}
        initial={{
          rosterNo: row.rosterNo,
          displayName: row.displayName,
          jobGroup: row.jobGroup,
          departmentId: row.departmentId,
          firstName: row.firstName,
          lastName: row.lastName,
          idCardNo: row.idCardNo,
          phone: row.phone,
          address: row.address,
          notes: row.notes,
          isActive: row.isActive,
          branchId: primary,
          birthDate: dateInput(row.birthDate),
          startDate: personnelDateTimeInput(row.startDate),
          gender: row.gender,
          nationality: row.nationality,
          endDate: personnelDateTimeInput(row.endDate),
          exitKind: row.exitKind,
        }}
      />
    </div>
  )
}
