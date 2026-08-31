import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import {
  getBranchIds,
  hasPermission,
  isAdminInAnyBranch,
  type UserRole,
} from "@/lib/permissions"
import { canManageHrPositions } from "@/lib/hr-settings-nav-access"
import { listAccessiblePersonnelBranches, listPersonnelDepartments, listPositions } from "@/modules/hr"
import { GlassCard } from "@/components/glass"
import { PositionManager } from "./position-manager"

export const metadata: Metadata = { title: "ตำแหน่งและสายบังคับบัญชา" }

function canWrite(roles: UserRole[], action: "create" | "update" | "delete") {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_positions", action))
  )
}

export default async function HrPositionsPage(props: {
  searchParams: Promise<{ branchId?: string }>
}) {
  const searchParams = await props.searchParams
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canManageHrPositions(roles)) redirect("/hr/personnel")

  const companyId = session.user.companyId as string
  const { data: branches } = await listAccessiblePersonnelBranches(prisma, { companyId, roles })

  if (!searchParams.branchId && branches[0]) {
    redirect(`/hr/positions?branchId=${branches[0].id}`)
  }

  const branchId = searchParams.branchId
  let error: string | null = null
  let view: Awaited<ReturnType<typeof listPositions>>["data"] | null = null
  let departments: { id: string; name: string; code: string | null }[] = []

  if (branchId) {
    try {
      const [positions, depts] = await Promise.all([
        listPositions(prisma, { companyId, roles, branchId, includeInactive: true }),
        listPersonnelDepartments(prisma, { companyId, roles, branchIds: [branchId] }),
      ])
      view = positions.data
      departments = depts.data.map((d) => ({ id: d.id, name: d.name, code: d.code }))
    } catch (e) {
      if (e instanceof ForbiddenError) error = "ไม่มีสิทธิ์ในสาขาที่เลือก"
      else if (e instanceof ValidationError) error = e.message
      else throw e
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">ตำแหน่งและสายบังคับบัญชา</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          จัดต้นไม้ตำแหน่งของแต่ละสาขา กำหนดหัวหน้า อัตรากำลัง และหน้าที่ความรับผิดชอบ
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </p>
      )}

      {branches.length === 0 ? (
        <GlassCard className="px-5 py-12 text-center">
          <p className="text-sm font-medium text-foreground">ยังไม่มีสาขาที่จัดตำแหน่งได้</p>
          <p className="mt-1 text-sm text-muted-foreground">
            ต้องได้รับสิทธิ์ในสาขาก่อนจึงจะจัดผังตำแหน่งได้
          </p>
        </GlassCard>
      ) : (
        <PositionManager
          branches={branches}
          branchId={branchId ?? ""}
          departments={departments}
          view={view}
          perms={{
            canCreate: canWrite(roles, "create"),
            canUpdate: canWrite(roles, "update"),
            canDelete: canWrite(roles, "delete"),
          }}
        />
      )}
    </div>
  )
}
