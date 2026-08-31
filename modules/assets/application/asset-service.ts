import { z } from "zod"
import { Prisma, type PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"

export const ASSET_TYPES = ["VEHICLE", "MACHINE"] as const
export const ASSET_STATUSES = ["REGISTERED", "ACTIVE", "IDLE", "RETIRED", "DISPOSED"] as const
export const ASSET_OWNERSHIPS = ["COMPANY", "LEASED", "EXTERNAL"] as const

const DEFAULT_PAGE_SIZE = 50

export const createAssetSchema = z.object({
  branchId: z.string().uuid(),
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(255),
  type: z.enum(ASSET_TYPES),
  status: z.enum(ASSET_STATUSES).optional(),
  ownership: z.enum(ASSET_OWNERSHIPS),
  serialNumber: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  locationDetail: z
    .string()
    .trim()
    .max(255)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  supplierId: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  acquiredAt: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  isActive: z.boolean().optional(),
})

export const updateAssetSchema = createAssetSchema.partial()

export type CreateAssetInput = z.input<typeof createAssetSchema>
export type UpdateAssetInput = z.input<typeof updateAssetSchema>

function canAssets(roles: UserRole[], action: "create" | "read" | "update" | "delete"): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "assets", action))
  )
}

function parseDateOnly(value: string): Date {
  const d = new Date(`${value}T00:00:00`)
  if (!Number.isFinite(d.getTime())) throw new ValidationError("วันที่ไม่ถูกต้อง")
  return d
}

function isoDate(value: Date | null | undefined): string | null {
  if (!value) return null
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, "0")
  const d = String(value.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function isUniqueCodeError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

export function assetCodePrefix(year = new Date().getFullYear()): string {
  return `AST-${year}-`
}

export function formatAssetCode(seq: number, year = new Date().getFullYear()): string {
  return `${assetCodePrefix(year)}${String(seq).padStart(5, "0")}`
}

export function parseAssetCodeSeq(code: string | null | undefined, prefix: string): number {
  if (!code?.startsWith(prefix)) return 0
  const n = parseInt(code.slice(prefix.length), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

async function assertBranchAllowed(
  db: PrismaClient,
  companyId: string,
  branchId: string,
  roles: UserRole[]
) {
  const branch = await db.branch.findFirst({
    where: { id: branchId, companyId, deletedAt: null, isActive: true },
    select: { id: true },
  })
  if (!branch) throw new ValidationError("สาขาไม่ถูกต้อง")
  if (!isAdminInAnyBranch(roles) && !getBranchIds(roles).includes(branchId)) {
    throw new ForbiddenError("ไม่มีสิทธิ์ในสาขาที่เลือก")
  }
}

async function assertSupplierAllowed(
  db: PrismaClient,
  companyId: string,
  supplierId: string | null | undefined
) {
  if (!supplierId) return
  const supplier = await db.supplier.findFirst({
    where: { id: supplierId, companyId, isActive: true },
    select: { id: true },
  })
  if (!supplier) throw new ValidationError("ผู้ขายไม่ถูกต้อง")
}

function assetWhere(
  companyId: string,
  roles: UserRole[],
  branchId?: string | null
): Prisma.AssetWhereInput {
  const isAdmin = isAdminInAnyBranch(roles)
  const allowed = getBranchIds(roles)
  const base: Prisma.AssetWhereInput = { companyId, deletedAt: null }
  if (branchId) {
    if (!isAdmin && !allowed.includes(branchId)) {
      return { id: "00000000-0000-0000-0000-000000000000" }
    }
    return { ...base, branchId }
  }
  if (!isAdmin) {
    return {
      ...base,
      branchId: { in: allowed.length ? allowed : ["00000000-0000-0000-0000-000000000000"] },
    }
  }
  return base
}

const assetInclude = {
  branch: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true } },
  creator: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.AssetInclude

function serializeAsset(row: Prisma.AssetGetPayload<{ include: typeof assetInclude }>) {
  return {
    id: row.id,
    companyId: row.companyId,
    branchId: row.branchId,
    branchName: row.branch.name,
    code: row.code,
    name: row.name,
    type: row.type,
    status: row.status,
    ownership: row.ownership,
    serialNumber: row.serialNumber,
    locationDetail: row.locationDetail,
    supplierId: row.supplierId,
    supplierName: row.supplier?.name ?? null,
    acquiredAt: isoDate(row.acquiredAt),
    isActive: row.isActive,
    createdById: row.createdBy,
    createdByName: row.creator ? `${row.creator.firstName} ${row.creator.lastName}`.trim() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export type AssetDto = ReturnType<typeof serializeAsset>

export async function listAssets(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    branchId?: string | null
    type?: string | null
    status?: string | null
    ownership?: string | null
    search?: string | null
    page?: number
    pageSize?: number
  }
) {
  if (!canAssets(params.roles, "read")) throw new ForbiddenError()
  const where: Prisma.AssetWhereInput = assetWhere(params.companyId, params.roles, params.branchId)
  if (params.type && ASSET_TYPES.includes(params.type as (typeof ASSET_TYPES)[number])) {
    where.type = params.type as (typeof ASSET_TYPES)[number]
  }
  if (params.status && ASSET_STATUSES.includes(params.status as (typeof ASSET_STATUSES)[number])) {
    where.status = params.status as (typeof ASSET_STATUSES)[number]
  }
  if (params.ownership && ASSET_OWNERSHIPS.includes(params.ownership as (typeof ASSET_OWNERSHIPS)[number])) {
    where.ownership = params.ownership as (typeof ASSET_OWNERSHIPS)[number]
  }
  if (params.search?.trim()) {
    const q = params.search.trim()
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { serialNumber: { contains: q, mode: "insensitive" } },
    ]
  }

  const page = params.page && params.page > 0 ? params.page : 1
  const pageSize =
    params.pageSize && params.pageSize > 0 && params.pageSize <= 100
      ? params.pageSize
      : DEFAULT_PAGE_SIZE

  const [rows, total] = await Promise.all([
    db.asset.findMany({
      where,
      include: assetInclude,
      orderBy: [{ code: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.asset.count({ where }),
  ])

  return {
    data: rows.map(serializeAsset),
    total,
    page,
    pageSize,
  }
}

export async function getAsset(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canAssets(params.roles, "read")) throw new ForbiddenError()
  const row = await db.asset.findFirst({
    where: { id: params.id, ...assetWhere(params.companyId, params.roles) },
    include: assetInclude,
  })
  if (!row) throw new NotFoundError("ไม่พบรายการ")
  return { data: serializeAsset(row) }
}

export async function createAsset(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    input: CreateAssetInput
  }
) {
  if (!canAssets(params.roles, "create")) throw new ForbiddenError()
  await assertBranchAllowed(db, params.companyId, params.input.branchId, params.roles)
  await assertSupplierAllowed(db, params.companyId, params.input.supplierId)
  const acquiredAt = params.input.acquiredAt ? parseDateOnly(params.input.acquiredAt) : null
  try {
    const row = await db.asset.create({
      data: {
        companyId: params.companyId,
        branchId: params.input.branchId,
        code: params.input.code,
        name: params.input.name,
        type: params.input.type,
        status: params.input.status ?? "REGISTERED",
        ownership: params.input.ownership,
        serialNumber: params.input.serialNumber ?? null,
        locationDetail: params.input.locationDetail ?? null,
        supplierId: params.input.supplierId ?? null,
        acquiredAt,
        isActive: params.input.isActive ?? true,
        createdBy: params.userId,
      },
      include: assetInclude,
    })
    return { data: serializeAsset(row) }
  } catch (error) {
    if (isUniqueCodeError(error)) throw new ValidationError("รหัสทะเบียนนี้มีอยู่แล้วในบริษัท")
    throw error
  }
}

export async function updateAsset(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    id: string
    input: UpdateAssetInput
  }
) {
  if (!canAssets(params.roles, "update")) throw new ForbiddenError()
  const existing = await db.asset.findFirst({
    where: { id: params.id, ...assetWhere(params.companyId, params.roles) },
    select: { id: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบรายการ")
  if (params.input.branchId) {
    await assertBranchAllowed(db, params.companyId, params.input.branchId, params.roles)
  }
  if (params.input.supplierId !== undefined) {
    await assertSupplierAllowed(db, params.companyId, params.input.supplierId)
  }

  const data: Prisma.AssetUpdateInput = {}
  if (params.input.branchId) data.branch = { connect: { id: params.input.branchId } }
  if (params.input.code !== undefined) data.code = params.input.code
  if (params.input.name !== undefined) data.name = params.input.name
  if (params.input.type !== undefined) data.type = params.input.type
  if (params.input.status !== undefined) data.status = params.input.status
  if (params.input.ownership !== undefined) data.ownership = params.input.ownership
  if (params.input.serialNumber !== undefined) data.serialNumber = params.input.serialNumber
  if (params.input.locationDetail !== undefined) data.locationDetail = params.input.locationDetail
  if (params.input.supplierId !== undefined) {
    data.supplier = params.input.supplierId
      ? { connect: { id: params.input.supplierId } }
      : { disconnect: true }
  }
  if (params.input.acquiredAt !== undefined) {
    data.acquiredAt = params.input.acquiredAt ? parseDateOnly(params.input.acquiredAt) : null
  }
  if (params.input.isActive !== undefined) data.isActive = params.input.isActive

  try {
    const row = await db.asset.update({
      where: { id: params.id },
      data,
      include: assetInclude,
    })
    return { data: serializeAsset(row) }
  } catch (error) {
    if (isUniqueCodeError(error)) throw new ValidationError("รหัสทะเบียนนี้มีอยู่แล้วในบริษัท")
    throw error
  }
}

export async function deleteAsset(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canAssets(params.roles, "delete")) throw new ForbiddenError()
  const existing = await db.asset.findFirst({
    where: { id: params.id, ...assetWhere(params.companyId, params.roles) },
    select: { id: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบรายการ")
  await db.asset.update({
    where: { id: params.id },
    data: { deletedAt: new Date(), isActive: false },
  })
  return { success: true }
}

export async function suggestNextAssetCode(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[] }
) {
  if (!canAssets(params.roles, "read") && !canAssets(params.roles, "create")) {
    throw new ForbiddenError()
  }
  const year = new Date().getFullYear()
  const prefix = assetCodePrefix(year)
  for (let attempt = 0; attempt < 5; attempt++) {
    const latest = await db.asset.findFirst({
      where: { companyId: params.companyId, code: { startsWith: prefix } },
      orderBy: { code: "desc" },
      select: { code: true },
    })
    const next = formatAssetCode(parseAssetCodeSeq(latest?.code, prefix) + 1 + attempt, year)
    const exists = await db.asset.findFirst({
      where: { companyId: params.companyId, code: next },
      select: { id: true },
    })
    if (!exists) return { data: { code: next } }
  }
  throw new ValidationError("ไม่สามารถแนะนำรหัสได้ กรุณากรอกเอง")
}

export async function listAccessibleBranches(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[] }
) {
  if (!canAssets(params.roles, "read")) throw new ForbiddenError()
  const isAdmin = isAdminInAnyBranch(params.roles)
  const allowed = getBranchIds(params.roles)
  const branches = await db.branch.findMany({
    where: {
      companyId: params.companyId,
      deletedAt: null,
      isActive: true,
      ...(isAdmin ? {} : { id: { in: allowed.length ? allowed : ["00000000-0000-0000-0000-000000000000"] } }),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  return { data: branches }
}

export async function listActiveSuppliers(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[] }
) {
  if (!canAssets(params.roles, "read")) throw new ForbiddenError()
  const suppliers = await db.supplier.findMany({
    where: { companyId: params.companyId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 500,
  })
  return { data: suppliers }
}

export async function getAssetFormOptions(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[] }
) {
  const [branches, suppliers] = await Promise.all([
    listAccessibleBranches(db, params),
    listActiveSuppliers(db, params),
  ])
  return {
    data: {
      branches: branches.data,
      suppliers: suppliers.data,
    },
  }
}
