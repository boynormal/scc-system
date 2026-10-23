import { z } from "zod"
import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { listFuelAssets } from "@/modules/fuel"

/** Assets of one branch that can receive fuel, with last meter readings. */
export const GET = withAuth(async (req, _ctx, session) => {
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "fuel", "read")
  if (denied) return denied
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId")
  if (!branchId || !z.string().uuid().safeParse(branchId).success) throw new ValidationError("กรุณาเลือกสาขา")
  const result = await listFuelAssets(prisma, {
    companyId: session.user.companyId as string,
    roles,
    branchId,
    search: searchParams.get("search"),
  })
  return Response.json(result)
})
