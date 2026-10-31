import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { requestAuditMeta } from "@/lib/request-audit"
import {
  createDocument,
  createDocumentSchema,
  listDocuments,
  type DocFileKind,
  type DocSort,
} from "@/modules/document_center"

export const runtime = "nodejs"

const FILE_KINDS = new Set<DocFileKind>(["pdf", "image", "excel", "word", "powerpoint", "other"])
const SORTS = new Set<DocSort>(["updated", "name", "code"])

function kindOf(value: string | null): DocFileKind | null {
  return value && FILE_KINDS.has(value as DocFileKind) ? (value as DocFileKind) : null
}

export const GET = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "documents", "read")
  if (denied) return denied
  const { searchParams } = new URL(req.url)
  const sort = searchParams.get("sort")
  const status = searchParams.get("status")
  const kpi = searchParams.get("kpi")
  const mode = searchParams.get("mode")
  const result = await listDocuments(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    mode: mode === "mine" || mode === "favorite" || mode === "recent" ? mode : "all",
    q: searchParams.get("q"),
    typeId: searchParams.get("type"),
    categoryId: searchParams.get("category"),
    branchFilter: searchParams.get("branch"),
    departmentId: searchParams.get("dept"),
    status: status === "ACTIVE" || status === "INACTIVE" || status === "DELETED" ? status : null,
    fileKind: kindOf(searchParams.get("file")),
    kpi: kpi === "active" || kpi === "expiring" || kpi === "favorite" ? kpi : null,
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    sort: sort && SORTS.has(sort as DocSort) ? (sort as DocSort) : "updated",
    page: Number(searchParams.get("page") || 1),
    pageSize: Number(searchParams.get("pageSize") || 24),
  })
  return Response.json(result)
})

function field(form: FormData, key: string): string {
  const value = form.get(key)
  return typeof value === "string" ? value.trim() : ""
}

export const POST = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "documents", "create")
  if (denied) return denied
  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) throw new ValidationError("ไม่พบไฟล์")
  const parsed = createDocumentSchema.safeParse({
    documentCode: field(form, "documentCode") || null,
    documentName: field(form, "documentName"),
    categoryId: field(form, "categoryId"),
    typeId: field(form, "typeId"),
    description: field(form, "description") || null,
    requiresAcknowledgement: field(form, "requiresAcknowledgement") === "on",
  })
  if (!parsed.success) throw new ValidationError("ข้อมูลไม่ถูกต้อง")
  const result = await createDocument(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    input: parsed.data,
    originalName: file.name,
    body: Buffer.from(await file.arrayBuffer()),
    audit: requestAuditMeta(req),
  })
  return Response.json(result)
})
