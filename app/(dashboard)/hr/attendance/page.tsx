import { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { Card } from "@/components/ui/card"
import { AttendanceImportForm } from "./attendance-import-form"
import { AttendanceEntriesPanel } from "./attendance-entries-panel"
import { Clock } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"

export const metadata: Metadata = { title: "บันทึกเวลา" }

function canRead(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_attendance", "read"))
  )
}

function canCreate(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_attendance", "create"))
  )
}

function canDelete(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_attendance", "delete"))
  )
}

export default async function HrAttendancePage(props: { searchParams: Promise<{ branchId?: string }> }) {
  const searchParams = await props.searchParams
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canRead(roles)) redirect("/")

  const companyId = session.user.companyId
  const branches = await prisma.branch.findMany({
    where: { companyId, isActive: true, deletedAt: null },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  })
  const allowedBranchIds = isAdminInAnyBranch(roles) ? branches.map((b) => b.id) : getBranchIds(roles)
  const selectedBranchIdRaw = searchParams.branchId
  const selectedBranchId =
    selectedBranchIdRaw && allowedBranchIds.includes(selectedBranchIdRaw)
      ? selectedBranchIdRaw
      : branches.find((b) => allowedBranchIds.includes(b.id))?.id ?? null

  const allowed = getBranchIds(roles)
  const recent =
    !selectedBranchId || (!isAdminInAnyBranch(roles) && allowed.length === 0)
      ? []
      : await prisma.attendanceEntry.findMany({
          where: {
            companyId,
            branchId: selectedBranchId,
          },
          take: 200,
          include: {
            personnel: { select: { displayName: true, rosterNo: true, jobGroup: true } },
            branch: { select: { name: true, code: true } },
          },
          orderBy: [{ workDate: "desc" }, { personnel: { displayName: "asc" } }],
        })

  const tableRows = recent.map((row) => ({
    id: row.id,
    workDate: row.workDate.toISOString(),
    rosterNo: row.personnel.rosterNo,
    displayName: row.personnel.displayName,
    jobGroup: row.personnel.jobGroup,
    punchTimes: row.punchTimes,
    branchCode: row.branch.code,
    branchName: row.branch.name,
  }))
  const showDelete = canDelete(roles)
  const selectedBranch = selectedBranchId ? branches.find((b) => b.id === selectedBranchId) ?? null : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">บันทึกเวลา</h1>
        <p className="text-slate-500 text-sm mt-1">แยกการทำงานตามสาขาอย่างชัดเจน เพื่อลดการสลับข้อมูลผิดสาขา</p>
      </div>

      <Card padding="md">
        <form className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px]">
            <label className="block text-sm font-medium text-slate-700">บริบทสาขาที่กำลังใช้งาน</label>
            <select
              name="branchId"
              defaultValue={selectedBranchId ?? ""}
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              {branches
                .filter((b) => allowedBranchIds.includes(b.id))
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} {b.name}
                  </option>
                ))}
            </select>
          </div>
          <button type="submit" className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm hover:bg-slate-900">
            ใช้งานสาขานี้
          </button>
        </form>
        {selectedBranch && (
          <p className="mt-2 text-xs text-slate-500">
            ตอนนี้กำลังทำงานที่สาขา: <span className="font-medium text-slate-700">{selectedBranch.code} {selectedBranch.name}</span>
          </p>
        )}
      </Card>

      {canCreate(roles) && (
        <Card padding="md">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">นำเข้า Excel</h2>
          {!selectedBranchId ? (
            <p className="text-sm text-amber-700">กรุณาเลือกสาขาก่อนนำเข้า</p>
          ) : branches.length === 0 ? (
            <p className="text-sm text-amber-700">ยังไม่มีสาขาในระบบ — ตั้งค่าสาขาก่อน</p>
          ) : (
            <AttendanceImportForm branch={selectedBranch!} />
          )}
        </Card>
      )}

      <Card padding="none">
        {recent.length === 0 ? (
          <EmptyState
            icon={Clock}
            title={selectedBranchId ? "ยังไม่มีบันทึกเวลาในสาขานี้" : "ยังไม่ได้เลือกสาขา"}
            description={selectedBranchId ? "อัปโหลดไฟล์ Excel ด้านบน หรือรอนำเข้า" : "เลือกสาขาด้านบนเพื่อเริ่มใช้งาน"}
          />
        ) : (
          <AttendanceEntriesPanel rows={tableRows} branch={selectedBranch!} canDelete={showDelete} />
        )}
      </Card>
    </div>
  )
}
