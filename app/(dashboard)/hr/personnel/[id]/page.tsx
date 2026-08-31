import Link from "next/link"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { getPersonnel } from "@/modules/hr"
import { Badge } from "@/components/ui/badge"
import { GlassCard, GlassCardHeader, GlassCardTitle } from "@/components/glass"
import { PersonnelDeleteButton } from "../personnel-delete-button"

function formatUser(user: { firstName: string; lastName: string; username: string; email: string } | null) {
  if (!user) return "—"
  const name = `${user.firstName} ${user.lastName}`.trim()
  return name ? `${name} (${user.username})` : user.username
}

export default async function PersonnelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) notFound()
  const { id } = await params
  const roles = session.user.roles as UserRole[]

  let row
  try {
    const result = await getPersonnel(prisma, {
      companyId: session.user.companyId as string,
      roles,
      id,
    })
    row = result.data
  } catch {
    notFound()
  }

  const canUpdate =
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_personnel", "update"))
  const canDelete =
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_personnel", "delete"))

  const branchLabel =
    row.branchAssignments.length > 0
      ? row.branchAssignments
          .map((a) => `${a.branch.code} — ${a.branch.name}${a.isPrimary ? " (หลัก)" : ""}`)
          .join(", ")
      : row.branch
        ? `${row.branch.code} — ${row.branch.name}`
        : "—"

  const fields: { label: string; value: string }[] = [
    { label: "รหัสรายชื่อ", value: row.rosterNo },
    { label: "ชื่อแสดง", value: row.displayName },
    { label: "กลุ่มงาน", value: row.jobGroup ?? "—" },
    { label: "ชื่อจริง", value: row.firstName ?? "—" },
    { label: "นามสกุล", value: row.lastName ?? "—" },
    { label: "เลขบัตรประชาชน", value: row.idCardNo ?? "—" },
    { label: "โทรศัพท์", value: row.phone ?? "—" },
    { label: "ที่อยู่", value: row.address ?? "—" },
    { label: "หมายเหตุ", value: row.notes ?? "—" },
    { label: "สาขา", value: branchLabel },
    {
      label: "แผนก",
      value: row.department
        ? row.department.code
          ? `${row.department.name} (${row.department.code})`
          : row.department.name
        : "—",
    },
    { label: "บัญชีผู้ใช้", value: formatUser(row.user) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/hr/personnel" className="text-sm text-blue-700 hover:text-blue-900">
            ← บุคลากร
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-foreground">{row.displayName}</h1>
          <p className="mt-0.5 font-mono text-sm text-muted-foreground">{row.rosterNo}</p>
          <div className="mt-2">
            {row.isActive ? (
              <Badge className="bg-emerald-100 text-emerald-800">ใช้งาน</Badge>
            ) : (
              <Badge variant="outline">ปิดใช้งาน</Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canUpdate && (
            <Link
              href={`/hr/personnel/${row.id}/edit`}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted/60"
            >
              แก้ไข
            </Link>
          )}
          {canDelete && <PersonnelDeleteButton id={row.id} />}
        </div>
      </div>

      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>รายละเอียด</GlassCardTitle>
        </GlassCardHeader>
        <dl className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{f.label}</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{f.value}</dd>
            </div>
          ))}
        </dl>
      </GlassCard>
    </div>
  )
}
