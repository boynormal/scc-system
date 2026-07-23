import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { importAttendanceFromXls } from "@/modules/hr"

export const POST = withAuth(async (req, _ctx, session) => {
  const form = await req.formData()
  const file = form.get("file")
  const branchId = form.get("branchId")

  const data = await importAttendanceFromXls(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
    userId: session.user.id as string,
    branchId: typeof branchId === "string" ? branchId : null,
    file: file instanceof Blob ? file : null,
    fileName: file instanceof File && file.name ? file.name : "upload.xls",
  })
  return Response.json({ data })
})
