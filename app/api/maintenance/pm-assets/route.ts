import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { listPmAssetOptions } from "@/modules/maintenance"

/** ฟอร์มแผน (?for=plan) ได้ทรัพย์สินที่เปิดเข้าแผนซ่อมบำรุง ฟอร์มแจ้งซ่อม (?for=work_order) ได้ทรัพย์สินที่ยังใช้งานทุกใบ */
export const GET = withAuth(async (req, _ctx, session) => {
  const roles = session.user.roles as UserRole[]
  const { searchParams } = new URL(req.url)
  const forWorkOrder = searchParams.get("for") === "work_order"
  const resource = forWorkOrder ? "work_orders" : "maintenance_plans"
  const action = searchParams.get("action") === "update" ? "update" : "create"
  const denied = forbidUnlessPermission(roles, resource, action)
  if (denied) return denied
  const data = await listPmAssetOptions(prisma, {
    companyId: session.user.companyId as string,
    roles,
    resource,
    action,
    includeId: searchParams.get("includeId"),
    requirePmEnabled: !forWorkOrder,
  })
  return Response.json({ data })
})
