import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import {
  getAssetMaintenance,
  linkAssetSchema,
  linkAssetTarget,
  setAssetMaintenancePm,
  setAssetMaintenancePmSchema,
} from "@/modules/assets"

export const GET = withAuth(async (_req, ctx, session) => {
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "assets", "read")
  if (denied) return denied
  const { id } = await ctx.params
  const result = await getAssetMaintenance(prisma, {
    companyId: session.user.companyId as string,
    roles,
    id,
  })
  return Response.json(result)
})

async function readBody(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    throw new ValidationError("Invalid body")
  }
}

/** สวิตช์ "เข้าแผนซ่อมบำรุง" */
export const PATCH = withAuth(async (req, ctx, session) => {
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "assets", "update")
  if (denied) return denied
  const { id } = await ctx.params
  const parsed = setAssetMaintenancePmSchema.safeParse(await readBody(req))
  if (!parsed.success) throw new ValidationError("ข้อมูลไม่ถูกต้อง")
  const result = await setAssetMaintenancePm(prisma, {
    companyId: session.user.companyId as string,
    roles,
    userId: session.user.id as string,
    id,
    enabled: parsed.data.enabled,
  })
  return Response.json(result)
})

/** ผูกกับเครื่องจักรหรือรถ ส่ง { kind: null } เพื่อเลิกผูก */
export const PUT = withAuth(async (req, ctx, session) => {
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "assets", "update")
  if (denied) return denied
  const { id } = await ctx.params
  const parsed = linkAssetSchema.safeParse(await readBody(req))
  if (!parsed.success) throw new ValidationError("ข้อมูลไม่ถูกต้อง")
  const result = await linkAssetTarget(prisma, {
    companyId: session.user.companyId as string,
    roles,
    userId: session.user.id as string,
    id,
    input: parsed.data,
  })
  return Response.json(result)
})
