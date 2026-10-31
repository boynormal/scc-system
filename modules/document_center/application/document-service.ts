import type { Prisma, PrismaClient } from "@prisma/client"
import { z } from "zod"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import type { RequestAuditMeta } from "@/lib/request-audit"
import { readBranchSharing } from "@/shared/permissions/branch-sharing"
import { canDocuments, canTouchDocument, documentWhere } from "./access"
import {
  EXPIRING_WITHIN_DAYS,
  assertDateOrder,
  contentTypesForKind,
  dateOnlyString,
  descendantIds,
  fileKindOf,
  parseDateOnly,
  personName,
  type DocFileKind,
  type DocListItem,
  type DocListMode,
  type DocSort,
  type DocSummary,
  type DocVersionItem,
} from "./rules"

const metadataSchema = z.object({
  documentCode: z.string().trim().max(50).nullable().optional(),
  documentName: z.string().trim().min(1).max(255),
  categoryId: z.string().uuid(),
  typeId: z.string().uuid(),
  description: z.string().trim().max(4000).nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  requiresAcknowledgement: z.boolean().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
})

export const createDocumentSchema = metadataSchema
export const updateDocumentSchema = metadataSchema.partial()
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>

export type DocumentListQuery = {
  companyId: string
  roles: UserRole[]
  userId: string
  mode?: DocListMode
  q?: string | null
  typeId?: string | null
  categoryId?: string | null
  branchFilter?: string | null
  departmentId?: string | null
  status?: "ACTIVE" | "INACTIVE" | "DELETED" | null
  fileKind?: DocFileKind | null
  kpi?: "active" | "expiring" | "favorite" | null
  from?: string | null
  to?: string | null
  sort?: DocSort | null
  page: number
  pageSize: number
}

type ListRow = {
  id: string
  documentCode: string
  documentName: string
  description: string | null
  status: "ACTIVE" | "INACTIVE"
  tags: string[]
  branchId: string | null
  departmentId: string | null
  effectiveDate: Date | null
  expiryDate: Date | null
  createdById: string
  updatedAt: Date
  deletedAt: Date | null
  requiresAcknowledgement: boolean
  category: { id: string; name: string }
  type: { id: string; code: string; name: string }
  branch: { name: string } | null
  department: { name: string } | null
  updatedBy: { firstName: string; lastName: string }
  currentVersion: {
    id: string
    versionNumber: number
    storedFile: { originalName: string; contentType: string; sizeBytes: number } | null
  } | null
  favorites: { userId: string }[]
}

function listInclude(userId: string): Prisma.DocCenterDocumentInclude {
  return {
    category: { select: { id: true, name: true } },
    type: { select: { id: true, code: true, name: true } },
    branch: { select: { name: true } },
    department: { select: { name: true } },
    updatedBy: { select: { firstName: true, lastName: true } },
    currentVersion: {
      select: {
        id: true,
        versionNumber: true,
        storedFile: { select: { originalName: true, contentType: true, sizeBytes: true } },
      },
    },
    favorites: { where: { userId }, select: { userId: true } },
  }
}

export function serializeDocument(row: ListRow): DocListItem {
  const file = row.currentVersion?.storedFile ?? null
  const kind = fileKindOf(file?.contentType, file?.originalName)
  return {
    id: row.id,
    documentCode: row.documentCode,
    documentName: row.documentName,
    description: row.description,
    status: row.status,
    tags: row.tags,
    categoryId: row.category.id,
    categoryName: row.category.name,
    typeId: row.type.id,
    typeCode: row.type.code,
    typeName: row.type.name,
    branchId: row.branchId,
    branchName: row.branch?.name ?? null,
    departmentId: row.departmentId,
    departmentName: row.department?.name ?? null,
    effectiveDate: dateOnlyString(row.effectiveDate),
    expiryDate: dateOnlyString(row.expiryDate),
    updatedAt: row.updatedAt.toISOString(),
    createdById: row.createdById,
    updatedByName: personName(row.updatedBy),
    versionId: row.currentVersion?.id ?? null,
    versionNumber: row.currentVersion?.versionNumber ?? null,
    fileName: file?.originalName ?? null,
    contentType: file?.contentType ?? null,
    sizeBytes: file?.sizeBytes ?? null,
    fileKind: kind,
    favorite: row.favorites.length > 0,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    requiresAcknowledgement: row.requiresAcknowledgement,
    acknowledgedAt: null,
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function asUuid(value: string | null | undefined): string | null {
  return value && UUID.test(value) ? value : null
}

function utcDay(value: string): Date {
  try {
    const parsed = parseDateOnly(value)
    if (!parsed) throw new Error("INVALID_DATE")
    return parsed
  } catch {
    throw new ValidationError("วันที่ไม่ถูกต้อง")
  }
}

function expiringRange(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + EXPIRING_WITHIN_DAYS)
  return { gte: start, lte: end }
}

async function scopedWhere(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; shareView?: boolean; branchFilter?: string | null; includeDeleted?: boolean }
) {
  const share = params.shareView ?? (await readBranchSharing(db, params.companyId)).documents.view
  return documentWhere({
    companyId: params.companyId,
    roles: params.roles,
    shareView: share,
    branchFilter: params.branchFilter,
    includeDeleted: params.includeDeleted,
  })
}

async function buildListWhere(db: PrismaClient, params: DocumentListQuery): Promise<Prisma.DocCenterDocumentWhereInput> {
  const deleted = params.status === "DELETED"
  if (deleted && !canDocuments(params.roles, "delete")) return { id: "00000000-0000-0000-0000-000000000000" }
  const branchFilter =
    params.branchFilter === "company" || asUuid(params.branchFilter) ? params.branchFilter : null
  const where = await scopedWhere(db, {
    companyId: params.companyId,
    roles: params.roles,
    branchFilter,
    includeDeleted: deleted,
  })
  const and: Prisma.DocCenterDocumentWhereInput[] = [where]
  if (deleted) and.push({ deletedAt: { not: null } })
  if (params.status === "ACTIVE" || params.status === "INACTIVE") and.push({ status: params.status })
  if (params.kpi === "active") and.push({ status: "ACTIVE" })
  if (params.kpi === "expiring" || params.kpi === "favorite") {
    if (params.kpi === "expiring") and.push({ status: "ACTIVE", expiryDate: expiringRange() })
    if (params.kpi === "favorite") and.push({ favorites: { some: { userId: params.userId } } })
  }
  if (params.mode === "mine") and.push({ createdById: params.userId })
  if (params.mode === "favorite") and.push({ favorites: { some: { userId: params.userId } } })
  if (asUuid(params.typeId)) and.push({ typeId: asUuid(params.typeId)! })
  if (asUuid(params.departmentId)) and.push({ departmentId: asUuid(params.departmentId)! })
  const categoryId = asUuid(params.categoryId)
  if (categoryId) {
    const rows = await db.docCenterCategory.findMany({
      where: { companyId: params.companyId },
      select: { id: true, parentId: true },
    })
    and.push({ categoryId: { in: descendantIds(rows, categoryId) } })
  }
  if (params.from || params.to) {
    const updatedAt: Prisma.DateTimeFilter = {}
    if (params.from) updatedAt.gte = utcDay(params.from)
    if (params.to) {
      const end = utcDay(params.to)
      end.setUTCDate(end.getUTCDate() + 1)
      updatedAt.lt = end
    }
    and.push({ updatedAt })
  }
  const kindFilter = params.fileKind ? contentTypesForKind(params.fileKind) : null
  if (kindFilter) and.push({ currentVersion: { storedFile: { contentType: { in: kindFilter } } } })
  const q = params.q?.trim()
  if (q) {
    and.push({
      OR: [
        { documentCode: { contains: q, mode: "insensitive" } },
        { documentName: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { category: { name: { contains: q, mode: "insensitive" } } },
        { type: { name: { contains: q, mode: "insensitive" } } },
        { currentVersion: { storedFile: { originalName: { contains: q, mode: "insensitive" } } } },
      ],
    })
  }
  return { AND: and }
}

function orderBy(sort: DocSort | null | undefined): Prisma.DocCenterDocumentOrderByWithRelationInput {
  if (sort === "name") return { documentName: "asc" }
  if (sort === "code") return { documentCode: "asc" }
  return { updatedAt: "desc" }
}

export async function listDocuments(db: PrismaClient, params: DocumentListQuery) {
  if (!canDocuments(params.roles, "read")) throw new ForbiddenError()
  const page = Number.isFinite(params.page) ? Math.max(1, Math.floor(params.page)) : 1
  const pageSize = Math.min(100, Math.max(1, Number.isFinite(params.pageSize) ? Math.floor(params.pageSize) : 24))
  if (params.mode === "recent") return listRecent(db, params, page, pageSize)
  const where = await buildListWhere(db, params)
  const [total, rows] = await Promise.all([
    db.docCenterDocument.count({ where }),
    db.docCenterDocument.findMany({
      where,
      include: listInclude(params.userId),
      orderBy: orderBy(params.sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])
  return { data: (rows as unknown as ListRow[]).map(serializeDocument), total, page, pageSize }
}

async function listRecent(db: PrismaClient, params: DocumentListQuery, page: number, pageSize: number) {
  const where = await buildListWhere(db, { ...params, mode: "all" })
  const grouped = await db.docCenterAccessLog.groupBy({
    by: ["documentId"],
    where: { userId: params.userId, document: where },
    _max: { createdAt: true },
  })
  grouped.sort((a, b) => (b._max.createdAt?.getTime() ?? 0) - (a._max.createdAt?.getTime() ?? 0))
  const slice = grouped.slice((page - 1) * pageSize, page * pageSize)
  const ids = slice.map((row) => row.documentId)
  const rows = ids.length
    ? await db.docCenterDocument.findMany({ where: { id: { in: ids } }, include: listInclude(params.userId) })
    : []
  const byId = new Map((rows as unknown as ListRow[]).map((row) => [row.id, row]))
  const data = ids.flatMap((id) => {
    const row = byId.get(id)
    return row ? [serializeDocument(row)] : []
  })
  return { data, total: grouped.length, page, pageSize }
}

export async function getDocument(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; userId: string; id: string }
) {
  if (!canDocuments(params.roles, "read")) throw new ForbiddenError()
  const where = await scopedWhere(db, {
    ...params,
    includeDeleted: canDocuments(params.roles, "delete"),
  })
  const row = await db.docCenterDocument.findFirst({
    where: { id: params.id, AND: [where] },
    include: {
      ...listInclude(params.userId),
      versions: {
        orderBy: { versionNumber: "desc" },
        include: {
          uploadedBy: { select: { firstName: true, lastName: true } },
          storedFile: { select: { originalName: true, contentType: true, sizeBytes: true } },
        },
      },
    },
  })
  if (!row) throw new NotFoundError("ไม่พบเอกสาร")
  const item = serializeDocument(row as unknown as ListRow)
  const versions: DocVersionItem[] = row.versions.map((version) => ({
    id: version.id,
    versionNumber: version.versionNumber,
    changeNote: version.changeNote,
    fileName: version.storedFile?.originalName ?? null,
    contentType: version.storedFile?.contentType ?? null,
    sizeBytes: version.storedFile?.sizeBytes ?? null,
    fileKind: fileKindOf(version.storedFile?.contentType, version.storedFile?.originalName),
    uploadedByName: personName(version.uploadedBy),
    uploadedAt: version.createdAt.toISOString(),
    isCurrent: version.id === row.currentVersionId,
  }))
  let acknowledgedAt: string | null = null
  if (row.requiresAcknowledgement && row.currentVersionId) {
    const ack = await db.docCenterAcknowledgement.findUnique({
      where: { userId_versionId: { userId: params.userId, versionId: row.currentVersionId } },
    })
    acknowledgedAt = ack ? ack.createdAt.toISOString() : null
  }
  return { data: { ...item, acknowledgedAt }, versions }
}

export function metadataDates(input: { effectiveDate?: string | null; expiryDate?: string | null }) {
  let effective: Date | null | undefined
  let expiry: Date | null | undefined
  try {
    if (input.effectiveDate !== undefined) effective = parseDateOnly(input.effectiveDate)
    if (input.expiryDate !== undefined) expiry = parseDateOnly(input.expiryDate)
  } catch {
    throw new ValidationError("วันที่ไม่ถูกต้อง")
  }
  return { effective, expiry }
}

export function assertMetadataDates(effective: Date | null | undefined, expiry: Date | null | undefined) {
  try {
    assertDateOrder(effective ?? null, expiry ?? null)
  } catch {
    throw new ValidationError("วันหมดอายุต้องไม่ก่อนวันที่เริ่มใช้")
  }
}

export async function updateDocument(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    id: string
    input: UpdateDocumentInput
    audit?: RequestAuditMeta
  }
) {
  if (!canDocuments(params.roles, "update")) throw new ForbiddenError()
  const share = await readBranchSharing(db, params.companyId)
  const existing = await db.docCenterDocument.findFirst({
    where: {
      id: params.id,
      ...documentWhere({
        companyId: params.companyId,
        roles: params.roles,
        shareView: share.documents.edit,
      }),
    },
  })
  if (!existing || existing.deletedAt) throw new NotFoundError("ไม่พบเอกสาร")
  if (params.input.categoryId) await assertActiveCategory(db, params.companyId, params.input.categoryId)
  if (params.input.typeId) await assertActiveType(db, params.companyId, params.input.typeId)
  if (params.input.departmentId) await assertDepartment(db, params.companyId, params.input.departmentId)
  const dates = metadataDates(params.input)
  const effective = dates.effective === undefined ? existing.effectiveDate : dates.effective
  const expiry = dates.expiry === undefined ? existing.expiryDate : dates.expiry
  assertMetadataDates(effective, expiry)
  const data: Prisma.DocCenterDocumentUpdateInput = { updatedBy: { connect: { id: params.userId } } }
  if (params.input.documentName) data.documentName = params.input.documentName
  if (params.input.description !== undefined) data.description = params.input.description?.trim() || null
  if (params.input.status) data.status = params.input.status
  if (params.input.requiresAcknowledgement !== undefined) {
    data.requiresAcknowledgement = params.input.requiresAcknowledgement
  }
  if (params.input.categoryId) data.category = { connect: { id: params.input.categoryId } }
  if (params.input.typeId) data.type = { connect: { id: params.input.typeId } }
  if (params.input.departmentId !== undefined) {
    data.department = params.input.departmentId ? { connect: { id: params.input.departmentId } } : { disconnect: true }
  }
  if (dates.effective !== undefined) data.effectiveDate = dates.effective
  if (dates.expiry !== undefined) data.expiryDate = dates.expiry
  try {
    await db.$transaction(async (tx) => {
      await tx.docCenterDocument.update({ where: { id: existing.id }, data })
      await tx.auditLog.create({
        data: {
          userId: params.userId,
          tableName: "doc_center_documents",
          recordId: existing.id,
          action: "update",
          oldValues: { documentName: existing.documentName, status: existing.status },
          newValues: { documentName: params.input.documentName ?? existing.documentName, status: params.input.status ?? existing.status },
          ipAddress: params.audit?.ipAddress,
          userAgent: params.audit?.userAgent,
        },
      })
    })
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002") {
      throw new ValidationError("รหัสเอกสารนี้มีอยู่แล้ว")
    }
    throw err
  }
  return getDocument(db, params)
}

export async function softDeleteDocument(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; userId: string; id: string; audit?: RequestAuditMeta }
) {
  const row = await requireMutableDocument(db, params, "delete")
  if (row.deletedAt) throw new ValidationError("เอกสารถูกลบแล้ว")
  await db.$transaction(async (tx) => {
    await tx.docCenterDocument.update({ where: { id: row.id }, data: { deletedAt: new Date(), updatedById: params.userId } })
    await tx.auditLog.create({
      data: {
        userId: params.userId,
        tableName: "doc_center_documents",
        recordId: row.id,
        action: "delete",
        oldValues: { deletedAt: null },
        newValues: { deletedAt: true },
        ipAddress: params.audit?.ipAddress,
        userAgent: params.audit?.userAgent,
      },
    })
  })
  return { data: { id: row.id } }
}

export async function restoreDocument(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; userId: string; id: string; audit?: RequestAuditMeta }
) {
  if (!canDocuments(params.roles, "delete")) throw new ForbiddenError()
  const share = await readBranchSharing(db, params.companyId)
  const row = await db.docCenterDocument.findFirst({
    where: {
      id: params.id,
      ...documentWhere({
        companyId: params.companyId,
        roles: params.roles,
        shareView: share.documents.delete,
        includeDeleted: true,
      }),
    },
  })
  if (!row?.deletedAt) throw new NotFoundError("ไม่พบเอกสารที่ลบไว้")
  await db.$transaction(async (tx) => {
    await tx.docCenterDocument.update({ where: { id: row.id }, data: { deletedAt: null, updatedById: params.userId } })
    await tx.auditLog.create({
      data: {
        userId: params.userId,
        tableName: "doc_center_documents",
        recordId: row.id,
        action: "restore",
        newValues: { deletedAt: null },
        ipAddress: params.audit?.ipAddress,
        userAgent: params.audit?.userAgent,
      },
    })
  })
  return { data: { id: row.id } }
}

export async function setFavorite(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; userId: string; id: string; favorite: boolean }
) {
  if (!canDocuments(params.roles, "read")) throw new ForbiddenError()
  const where = await scopedWhere(db, params)
  const row = await db.docCenterDocument.findFirst({ where: { id: params.id, AND: [where] }, select: { id: true } })
  if (!row) throw new NotFoundError("ไม่พบเอกสาร")
  if (params.favorite) {
    await db.docCenterFavorite.upsert({
      where: { userId_documentId: { userId: params.userId, documentId: row.id } },
      create: { userId: params.userId, documentId: row.id },
      update: {},
    })
  } else {
    await db.docCenterFavorite.deleteMany({ where: { userId: params.userId, documentId: row.id } })
  }
  return { data: { id: row.id, favorite: params.favorite } }
}

export async function documentSummary(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; userId: string }
): Promise<DocSummary> {
  if (!canDocuments(params.roles, "read")) throw new ForbiddenError()
  const where = await scopedWhere(db, params)
  const [total, active, expiring, favorites] = await Promise.all([
    db.docCenterDocument.count({ where }),
    db.docCenterDocument.count({ where: { AND: [where, { status: "ACTIVE" }] } }),
    db.docCenterDocument.count({ where: { AND: [where, { status: "ACTIVE", expiryDate: expiringRange() }] } }),
    db.docCenterDocument.count({ where: { AND: [where, { favorites: { some: { userId: params.userId } } }] } }),
  ])
  return { total, active, expiring, favorites }
}

export async function categoryDocumentCounts(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[] }
) {
  if (!canDocuments(params.roles, "read")) throw new ForbiddenError()
  const where = await scopedWhere(db, params)
  const rows = await db.docCenterDocument.groupBy({
    by: ["categoryId"],
    where,
    _count: { _all: true },
  })
  return rows.map((row) => ({ categoryId: row.categoryId, count: row._count._all }))
}

export async function listAccessLogs(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; page: number; pageSize: number }
) {
  if (!canDocuments(params.roles, "approve")) throw new ForbiddenError()
  const whereDoc = await scopedWhere(db, params)
  const where = { document: whereDoc }
  const page = Math.max(1, params.page)
  const pageSize = Math.min(100, Math.max(1, params.pageSize))
  const [total, rows] = await Promise.all([
    db.docCenterAccessLog.count({ where }),
    db.docCenterAccessLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { firstName: true, lastName: true } },
        document: { select: { id: true, documentCode: true, documentName: true } },
        version: { select: { versionNumber: true } },
      },
    }),
  ])
  return {
    data: rows.map((row) => ({
      id: row.id,
      action: row.action,
      createdAt: row.createdAt.toISOString(),
      userName: personName(row.user),
      documentId: row.document.id,
      documentCode: row.document.documentCode,
      documentName: row.document.documentName,
      versionNumber: row.version?.versionNumber ?? null,
    })),
    total,
    page,
    pageSize,
  }
}

export async function listDocumentBranches(db: PrismaClient, params: { companyId: string; roles: UserRole[] }) {
  if (!canDocuments(params.roles, "read") && !canDocuments(params.roles, "create")) throw new ForbiddenError()
  const share = await readBranchSharing(db, params.companyId)
  const { isAdminInAnyBranch, getBranchIds } = await import("@/lib/permissions")
  const seeAll = isAdminInAnyBranch(params.roles) || share.documents.view || share.documents.create
  const allowed = getBranchIds(params.roles)
  const rows = await db.branch.findMany({
    where: {
      companyId: params.companyId,
      deletedAt: null,
      isActive: true,
      ...(seeAll ? {} : { id: { in: allowed.length ? allowed : ["00000000-0000-0000-0000-000000000000"] } }),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  return { data: rows }
}

export async function listDocumentDepartments(db: PrismaClient, params: { companyId: string; roles: UserRole[] }) {
  if (!canDocuments(params.roles, "read") && !canDocuments(params.roles, "create")) throw new ForbiddenError()
  const rows = await db.department.findMany({
    where: { companyId: params.companyId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  return { data: rows }
}

export async function assertActiveCategory(db: PrismaClient, companyId: string, categoryId: string) {
  const row = await db.docCenterCategory.findFirst({
    where: { id: categoryId, companyId, isActive: true },
    select: { id: true },
  })
  if (!row) throw new ValidationError("หมวดหมู่ไม่พร้อมใช้งาน")
}

export async function assertActiveType(db: PrismaClient, companyId: string, typeId: string) {
  const row = await db.docCenterType.findFirst({
    where: { id: typeId, companyId, isActive: true },
    select: { id: true },
  })
  if (!row) throw new ValidationError("ประเภทเอกสารไม่พร้อมใช้งาน")
}

export async function assertDepartment(db: PrismaClient, companyId: string, departmentId: string) {
  const row = await db.department.findFirst({
    where: { id: departmentId, companyId, isActive: true },
    select: { id: true },
  })
  if (!row) throw new ValidationError("ไม่พบแผนก")
}

export async function assertBranch(
  db: PrismaClient,
  companyId: string,
  roles: UserRole[],
  branchId: string,
  shared: boolean
) {
  if (
    !canTouchDocument(roles, "create", branchId, {
      view: shared,
      edit: shared,
      delete: shared,
      create: shared,
      approve: false,
    })
  ) {
    throw new ForbiddenError()
  }
  const row = await db.branch.findFirst({
    where: { id: branchId, companyId, deletedAt: null, isActive: true },
    select: { id: true },
  })
  if (!row) throw new ValidationError("ไม่พบสาขา")
}

export async function requireMutableDocument(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string },
  action: "update" | "delete"
) {
  if (!canDocuments(params.roles, action)) throw new ForbiddenError()
  const share = await readBranchSharing(db, params.companyId)
  const flag = action === "update" ? share.documents.edit : share.documents.delete
  const row = await db.docCenterDocument.findFirst({
    where: {
      id: params.id,
      ...documentWhere({ companyId: params.companyId, roles: params.roles, shareView: flag }),
    },
  })
  if (!row) throw new NotFoundError("ไม่พบเอกสาร")
  return row
}

export async function loadReadableDocument(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canDocuments(params.roles, "read")) throw new ForbiddenError()
  const where = await scopedWhere(db, { ...params, includeDeleted: canDocuments(params.roles, "delete") })
  const row = await db.docCenterDocument.findFirst({ where: { id: params.id, AND: [where] } })
  if (!row) throw new NotFoundError("ไม่พบเอกสาร")
  return row
}

export async function acknowledgeDocument(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; userId: string; id: string }
) {
  const row = await loadReadableDocument(db, params)
  if (row.deletedAt) throw new NotFoundError("ไม่พบเอกสาร")
  if (!row.requiresAcknowledgement) throw new ValidationError("เอกสารนี้ไม่ต้องรับทราบ")
  if (!row.currentVersionId) throw new ValidationError("ยังไม่มีเวอร์ชันให้รับทราบ")
  const where = { userId_versionId: { userId: params.userId, versionId: row.currentVersionId } }
  const existing = await db.docCenterAcknowledgement.findUnique({ where })
  if (existing) return { data: { acknowledgedAt: existing.createdAt.toISOString(), already: true } }
  try {
    const created = await db.docCenterAcknowledgement.create({
      data: {
        documentId: row.id,
        versionId: row.currentVersionId,
        userId: params.userId,
      },
    })
    return { data: { acknowledgedAt: created.createdAt.toISOString(), already: false } }
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002") {
      const again = await db.docCenterAcknowledgement.findUnique({ where })
      if (again) return { data: { acknowledgedAt: again.createdAt.toISOString(), already: true } }
    }
    throw err
  }
}

export async function listDocumentAcknowledgements(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canDocuments(params.roles, "approve")) throw new ForbiddenError()
  const row = await loadReadableDocument(db, params)
  if (!row.requiresAcknowledgement || !row.currentVersionId) {
    return { data: { required: Boolean(row.requiresAcknowledgement), acknowledged: [], pending: [] } }
  }
  const [users, acks] = await Promise.all([
    db.user.findMany({
      where: {
        companyId: params.companyId,
        deletedAt: null,
        isActive: true,
        passwordHash: { not: null },
        OR: [{ driverLogin: { is: null } }, { userBranchRoles: { some: {} } }],
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    db.docCenterAcknowledgement.findMany({
      where: { documentId: row.id, versionId: row.currentVersionId },
      select: { userId: true, createdAt: true },
    }),
  ])
  const ackByUser = new Map(acks.map((ack) => [ack.userId, ack.createdAt.toISOString()]))
  const acknowledged: { userId: string; name: string; acknowledgedAt: string }[] = []
  const pending: { userId: string; name: string }[] = []
  for (const user of users) {
    const name = `${user.firstName} ${user.lastName}`.trim()
    const at = ackByUser.get(user.id)
    if (at) acknowledged.push({ userId: user.id, name, acknowledgedAt: at })
    else pending.push({ userId: user.id, name })
  }
  acknowledged.sort((a, b) => b.acknowledgedAt.localeCompare(a.acknowledgedAt))
  return { data: { required: true, acknowledged, pending } }
}
