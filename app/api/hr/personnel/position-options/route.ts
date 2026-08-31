import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { listPositionOptions } from "@/modules/hr"

/** ตัวเลือกตำแหน่งสำหรับฟอร์มบุคลากร — รับได้หลายสาขาเหมือน department-options */
export const GET = withAuth(async (req, _ctx, session) => {
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "hr_personnel", "read")
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const branchIds = [...new Set(searchParams.getAll("branchId").filter(Boolean))]
  const companyId = session.user.companyId as string

  const perBranch = await Promise.all(
    branchIds.map(async (branchId) => {
      try {
        const { data } = await listPositionOptions(prisma, { companyId, roles, branchId })
        return data.map((option) => ({ ...option, branchId }))
      } catch {
        // สาขาที่ไม่มีสิทธิ์หรือไม่ถูกต้องให้เงียบ — ฟอร์มแค่ได้ตัวเลือกน้อยลง
        return []
      }
    })
  )

  return Response.json({ data: perBranch.flat() })
})
