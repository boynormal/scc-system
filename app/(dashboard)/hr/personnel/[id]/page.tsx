import Link from "next/link"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { getPersonnel, groupDutyItems, splitLines } from "@/modules/hr"
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

  const assignedBranches =
    row.branchAssignments.length > 0
      ? row.branchAssignments.map((item) => item.branch)
      : row.branch
        ? [row.branch]
        : []
  const branchCodeById = new Map(assignedBranches.map((branch) => [branch.id, branch.code]))

  function formatPosition(position: { name: string; code: string | null; branchId: string }) {
    const name = position.code ? `${position.name} (${position.code})` : position.name
    if (assignedBranches.length <= 1) return name
    const code = branchCodeById.get(position.branchId)
    return code ? `${code} — ${name}` : name
  }

  const positionLabel = row.positionAssignments.length
    ? row.positionAssignments.map((item) => formatPosition(item.position)).join(", ")
    : row.position
      ? formatPosition(row.position)
      : "—"

  const fields: { label: string; value: string }[] = [
    { label: "รหัสรายชื่อ", value: row.rosterNo },
    { label: "ชื่อเรียก", value: row.displayName },
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
    { label: "ตำแหน่ง", value: positionLabel },
    { label: "บัญชีผู้ใช้", value: formatUser(row.user) },
  ]

  const seatsByBranch = new Map<string, typeof row.positionAssignments>()
  for (const seat of row.positionAssignments) {
    const list = seatsByBranch.get(seat.position.branchId)
    if (list) list.push(seat)
    else seatsByBranch.set(seat.position.branchId, [seat])
  }
  const branchOrder = [
    ...assignedBranches.map((branch) => branch.id),
    ...[...seatsByBranch.keys()].filter((bid) => !branchCodeById.has(bid)),
  ]
  const dutySections = branchOrder
    .filter((bid) => seatsByBranch.has(bid))
    .map((bid) => ({
      branch: assignedBranches.find((branch) => branch.id === bid) ?? null,
      seats: seatsByBranch.get(bid)!.map((seat) => ({
        id: seat.id,
        position: seat.position.code ? `${seat.position.name} (${seat.position.code})` : seat.position.name,
        groups: groupDutyItems(seat.dutyItems.map((link) => link.dutyItem)),
        extra: splitLines(seat.extraDuties),
      })),
    }))

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

      {dutySections.length > 0 && (
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle>หน้าที่ที่ดูแล</GlassCardTitle>
          </GlassCardHeader>
          <div className="space-y-4">
            {dutySections.map((section) => (
              <div key={section.branch?.id ?? "other"} className="space-y-2">
                {dutySections.length > 1 && section.branch && (
                  <p className="text-sm font-semibold text-foreground">
                    {section.branch.code}
                    <span className="ml-1.5 font-normal text-muted-foreground">{section.branch.name}</span>
                  </p>
                )}
                {section.seats.map((seat) => (
                  <div key={seat.id} className="rounded-lg border border-border px-3 py-2">
                    <p className="text-sm font-medium text-foreground">{seat.position}</p>
                    {seat.groups.length === 0 && seat.extra.length === 0 ? (
                      <p className="mt-1 text-xs italic text-muted-foreground">ยังไม่ได้ติ๊กรายการ</p>
                    ) : (
                      <div className="mt-1 space-y-1.5">
                        {seat.groups.map((group) => (
                          <div key={group.categoryId}>
                            <p className="text-xs font-semibold text-foreground">{group.category}</p>
                            <ul className="list-disc pl-5 text-sm text-muted-foreground">
                              {group.items.map((item) => (
                                <li key={item.id}>
                                  {item.name}
                                  {!item.isActive && <span className="ml-1 text-xs">(ปิดใช้งาน)</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                        {seat.extra.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-foreground">หน้าที่เพิ่มเติม</p>
                            <ul className="list-disc pl-5 text-sm text-muted-foreground">
                              {seat.extra.map((line, i) => (
                                <li key={i}>{line}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  )
}
