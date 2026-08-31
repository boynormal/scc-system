import { z } from "zod"
import type { PrismaClient, Prisma } from "@prisma/client"
import { AppError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { replacePersonnelBranchesFromIds } from "./personnel-branch-utils"

const personnelFieldsSchema = z.object({
  branchId: z.string().uuid().nullable().optional(),
  branchIds: z.array(z.string().uuid()).max(50).optional(),
  primaryBranchId: z.string().uuid().optional(),
  rosterNo: z.string().min(1).max(30),
  displayName: z.string().min(1).max(255),
  jobGroup: z.string().max(100).nullable().optional(),
  firstName: z.string().max(100).nullable().optional(),
  lastName: z.string().max(100).nullable().optional(),
  idCardNo: z.string().max(30).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  userId: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  departmentId: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  positionId: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
})

function refinePrimaryBranch(
  data: { primaryBranchId?: string; branchIds?: string[] },
  ctx: z.RefinementCtx
) {
  if (data.primaryBranchId && data.branchIds?.length) {
    if (!data.branchIds.includes(data.primaryBranchId)) {
      ctx.addIssue({
        code: "custom",
        message: "primaryBranchId ต้องอยู่ใน branchIds",
        path: ["primaryBranchId"],
      })
    }
  }
}

export const createPersonnelSchema = personnelFieldsSchema.superRefine(refinePrimaryBranch)

export const updatePersonnelSchema = personnelFieldsSchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  })
  .superRefine(refinePrimaryBranch)

export type CreatePersonnelInput = z.infer<typeof createPersonnelSchema>
export type UpdatePersonnelInput = z.infer<typeof updatePersonnelSchema>

export function canReadPersonnel(roles: UserRole[]): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_personnel", "read"))
  )
}

export function canCreatePersonnel(roles: UserRole[]): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_personnel", "create"))
  )
}

export function canUpdatePersonnel(roles: UserRole[]): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_personnel", "update"))
  )
}

export function canDeletePersonnel(roles: UserRole[]): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_personnel", "delete"))
  )
}

const ROSTER_NO_DIGITS = /^\d+$/

export function parseRosterNoSeq(value: string): number | null {
  const t = value.trim()
  if (!ROSTER_NO_DIGITS.test(t)) return null
  const n = parseInt(t, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function formatRosterNo(seq: number): string {
  return String(seq).padStart(3, "0")
}

const personnelInclude = {
  branch: { select: { id: true, name: true, code: true } },
  department: { select: { id: true, name: true, code: true, branchId: true } },
  position: { select: { id: true, name: true, code: true, branchId: true } },
  user: { select: { id: true, firstName: true, lastName: true, username: true, email: true } },
  branchAssignments: {
    include: { branch: { select: { name: true, code: true, id: true } } },
    orderBy: [{ isPrimary: "desc" as const }, { createdAt: "asc" as const }],
  },
} satisfies Prisma.PersonnelInclude

function resolveBranchIdListFromUpdate(body: UpdatePersonnelInput): string[] | undefined {
  if (body.branchIds !== undefined) return [...new Set(body.branchIds)]
  if (body.branchId !== undefined) return body.branchId ? [body.branchId] : []
  return undefined
}

async function assertUserLinkAllowed(
  db: PrismaClient | Prisma.TransactionClient,
  companyId: string,
  userId: string,
  excludePersonnelId?: string
) {
  const user = await db.user.findFirst({
    where: { id: userId, companyId, deletedAt: null },
    select: { id: true, personnel: { select: { id: true } } },
  })
  if (!user) throw new ValidationError("บัญชีผู้ใช้ไม่ถูกต้อง")
  if (user.personnel && user.personnel.id !== excludePersonnelId) {
    throw new ValidationError("บัญชีนี้ผูกกับบุคลากรคนอื่นแล้ว")
  }
}

async function assertDepartmentAllowed(
  db: PrismaClient | Prisma.TransactionClient,
  companyId: string,
  departmentId: string,
  assignedBranchIds: string[]
) {
  const dept = await db.department.findFirst({
    where: { id: departmentId, isActive: true, branch: { companyId, deletedAt: null } },
    select: { id: true, branchId: true },
  })
  if (!dept) throw new ValidationError("แผนกไม่ถูกต้อง")
  if (!assignedBranchIds.includes(dept.branchId)) {
    throw new ValidationError("แผนกต้องอยู่ในสาขาที่เลือก")
  }
}

async function assertPositionAllowed(
  db: PrismaClient | Prisma.TransactionClient,
  companyId: string,
  positionId: string,
  assignedBranchIds: string[]
) {
  const position = await db.position.findFirst({
    where: { id: positionId, isActive: true, branch: { companyId, deletedAt: null } },
    select: { id: true, branchId: true },
  })
  if (!position) throw new ValidationError("ตำแหน่งไม่ถูกต้อง")
  if (!assignedBranchIds.includes(position.branchId)) {
    throw new ValidationError("ตำแหน่งต้องอยู่ในสาขาที่เลือก")
  }
}

async function findLivePersonnel(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  const allowed = getBranchIds(params.roles)
  const isAdmin = isAdminInAnyBranch(params.roles)
  const branchScope = personnelBranchWhereForRoles(isAdmin, allowed, null)
  const row = await db.personnel.findFirst({
    where: {
      id: params.id,
      companyId: params.companyId,
      deletedAt: null,
      ...(branchScope ? { AND: [branchScope] } : {}),
    },
    include: personnelInclude,
  })
  if (!row) throw new NotFoundError("ไม่พบรายการ")
  return row
}

function resolveBranchIdList(body: CreatePersonnelInput): string[] {
  if (body.branchIds?.length) return [...new Set(body.branchIds)]
  if (body.branchId) return [body.branchId]
  return []
}

function resolvePrimaryFromList(ids: string[], primaryBranchId?: string | null): string | null {
  if (ids.length === 0) return null
  if (primaryBranchId && ids.includes(primaryBranchId)) return primaryBranchId
  return ids[0]!
}

async function assertBranchesAllowed(
  db: PrismaClient,
  companyId: string,
  branchIds: string[],
  roles: UserRole[]
): Promise<void> {
  if (branchIds.length === 0) return
  const rows = await db.branch.findMany({
    where: { id: { in: branchIds }, companyId, deletedAt: null, isActive: true },
    select: { id: true },
  })
  if (rows.length !== branchIds.length) {
    throw new ValidationError("สาขาไม่ถูกต้อง")
  }
  if (!isAdminInAnyBranch(roles)) {
    const allowed = new Set(getBranchIds(roles))
    for (const id of branchIds) {
      if (!allowed.has(id)) {
        throw new ForbiddenError("ไม่มีสิทธิ์ในสาขาที่เลือก")
      }
    }
  }
}

export function personnelBranchWhereForRoles(
  isAdmin: boolean,
  allowed: string[],
  branchIdParam: string | null
): Prisma.PersonnelWhereInput | null {
  if (isAdmin) {
    if (!branchIdParam) return null
    return {
      OR: [
        { branchId: branchIdParam },
        { branchAssignments: { some: { branchId: branchIdParam } } },
      ],
    }
  }
  if (allowed.length === 0) return { id: "00000000-0000-0000-0000-000000000000" }
  if (branchIdParam) {
    if (!allowed.includes(branchIdParam)) return null
    return {
      OR: [
        { branchId: branchIdParam },
        { branchAssignments: { some: { branchId: branchIdParam } } },
      ],
    }
  }
  return {
    OR: [
      { branchId: { in: allowed } },
      { branchAssignments: { some: { branchId: { in: allowed } } } },
    ],
  }
}

export async function listPersonnel(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    branchId?: string | null
    search?: string | null
    isActive?: boolean | null
    departmentId?: string | null
    positionId?: string | null
    page: number
    pageSize: number
  }
) {
  if (!canReadPersonnel(params.roles)) throw new ForbiddenError()

  const {
    companyId,
    roles,
    branchId: branchIdParam = null,
    search,
    isActive: isActiveParam = null,
    departmentId: departmentIdParam = null,
    positionId: positionIdParam = null,
    page,
    pageSize,
  } = params

  if (branchIdParam) {
    const ok = await db.branch.findFirst({
      where: { id: branchIdParam, companyId, deletedAt: null, isActive: true },
      select: { id: true },
    })
    if (!ok) throw new ValidationError("Invalid branch")
  }

  const allowed = getBranchIds(roles)
  const isAdmin = isAdminInAnyBranch(roles)
  const branchScope = personnelBranchWhereForRoles(isAdmin, allowed, branchIdParam)

  if (branchScope === null && branchIdParam && !isAdmin) {
    throw new ForbiddenError()
  }

  const andParts: Prisma.PersonnelWhereInput[] = []
  if (branchScope) andParts.push(branchScope)
  if (search?.trim()) {
    const q = search.trim()
    andParts.push({
      OR: [
        { displayName: { contains: q, mode: "insensitive" as const } },
        { rosterNo: { contains: q, mode: "insensitive" as const } },
        { jobGroup: { contains: q, mode: "insensitive" as const } },
      ],
    })
  }
  if (isActiveParam === true || isActiveParam === false) {
    andParts.push({ isActive: isActiveParam })
  }
  if (departmentIdParam) {
    andParts.push({ departmentId: departmentIdParam })
  }
  if (positionIdParam) {
    andParts.push({ positionId: positionIdParam })
  }

  const where: Prisma.PersonnelWhereInput = {
    companyId,
    deletedAt: null,
    ...(andParts.length > 0 ? { AND: andParts } : {}),
  }

  if (!isAdmin && allowed.length === 0) {
    return { data: [], total: 0, page, pageSize, totalPages: 0 }
  }

  const [data, total] = await Promise.all([
    db.personnel.findMany({
      where,
      include: personnelInclude,
      orderBy: [{ displayName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.personnel.count({ where }),
  ])

  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 0 }
}

export async function createPersonnel(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; input: CreatePersonnelInput }
) {
  const { companyId, roles, input } = params
  if (!canCreatePersonnel(roles)) throw new ForbiddenError()

  const {
    branchId,
    primaryBranchId,
    rosterNo,
    displayName,
    jobGroup,
    firstName,
    lastName,
    idCardNo,
    phone,
    address,
    notes,
    userId,
    departmentId,
    positionId,
  } = input

  const resolvedBranchIds = resolveBranchIdList(input)
  const primary = resolvePrimaryFromList(resolvedBranchIds, primaryBranchId ?? null) ?? branchId ?? null

  await assertBranchesAllowed(db, companyId, resolvedBranchIds, roles)
  if (userId) await assertUserLinkAllowed(db, companyId, userId)
  if (departmentId) await assertDepartmentAllowed(db, companyId, departmentId, resolvedBranchIds)
  if (positionId) await assertPositionAllowed(db, companyId, positionId, resolvedBranchIds)

  if (resolvedBranchIds.length === 0 && !isAdminInAnyBranch(roles)) {
    const allowed = getBranchIds(roles)
    if (allowed.length === 0) throw new ForbiddenError()
  }

  try {
    return await db.$transaction(async (tx) => {
      const created = await tx.personnel.create({
        data: {
          companyId,
          branchId: primary,
          rosterNo: rosterNo.trim(),
          displayName: displayName.trim(),
          jobGroup: jobGroup?.trim() || null,
          firstName: firstName?.trim() || null,
          lastName: lastName?.trim() || null,
          idCardNo: idCardNo?.trim() || null,
          phone: phone?.trim() || null,
          address: address?.trim() || null,
          notes: notes?.trim() || null,
          userId: userId ?? null,
          departmentId: departmentId ?? null,
          positionId: positionId ?? null,
        },
      })
      if (resolvedBranchIds.length > 0) {
        await replacePersonnelBranchesFromIds(
          tx,
          created.id,
          resolvedBranchIds,
          primaryBranchId && resolvedBranchIds.includes(primaryBranchId) ? primaryBranchId : null
        )
      }
      return tx.personnel.findUniqueOrThrow({
        where: { id: created.id },
        include: personnelInclude,
      })
    })
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === "P2002") {
      throw new AppError("รหัสรายชื่อ (roster) ซ้ำในบริษัท", 409, "CONFLICT")
    }
    throw e
  }
}

export async function getPersonnel(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canReadPersonnel(params.roles)) throw new ForbiddenError()
  const row = await findLivePersonnel(db, params)
  return { data: row }
}

export async function updatePersonnel(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string; input: UpdatePersonnelInput }
) {
  const { companyId, roles, id, input } = params
  if (!canUpdatePersonnel(roles)) throw new ForbiddenError()

  const existing = await findLivePersonnel(db, { companyId, roles, id })

  const resolvedBranchIds = resolveBranchIdListFromUpdate(input)
  if (resolvedBranchIds) {
    await assertBranchesAllowed(db, companyId, resolvedBranchIds, roles)
  }
  if (input.userId) {
    await assertUserLinkAllowed(db, companyId, input.userId, existing.id)
  }

  const nextBranchIds =
    resolvedBranchIds ??
    (existing.branchAssignments.length
      ? existing.branchAssignments.map((a) => a.branchId)
      : existing.branchId
        ? [existing.branchId]
        : [])

  const data: Prisma.PersonnelUncheckedUpdateInput = {}
  if (input.rosterNo !== undefined) data.rosterNo = input.rosterNo.trim()
  if (input.displayName !== undefined) data.displayName = input.displayName.trim()
  if (input.jobGroup !== undefined) data.jobGroup = input.jobGroup?.trim() || null
  if (input.firstName !== undefined) data.firstName = input.firstName?.trim() || null
  if (input.lastName !== undefined) data.lastName = input.lastName?.trim() || null
  if (input.idCardNo !== undefined) data.idCardNo = input.idCardNo?.trim() || null
  if (input.phone !== undefined) data.phone = input.phone?.trim() || null
  if (input.address !== undefined) data.address = input.address?.trim() || null
  if (input.notes !== undefined) data.notes = input.notes?.trim() || null
  if (input.isActive !== undefined) data.isActive = input.isActive
  if (input.userId !== undefined) data.userId = input.userId

  if (resolvedBranchIds) {
    data.branchId = resolvePrimaryFromList(resolvedBranchIds, input.primaryBranchId ?? null)
  }

  let nextDepartmentId = input.departmentId !== undefined ? input.departmentId : existing.departmentId
  if (nextDepartmentId) {
    const dept = await db.department.findFirst({
      where: { id: nextDepartmentId, branch: { companyId } },
      select: { branchId: true, isActive: true },
    })
    if (input.departmentId) {
      await assertDepartmentAllowed(db, companyId, nextDepartmentId, nextBranchIds)
    } else if (!dept || !dept.isActive || !nextBranchIds.includes(dept.branchId)) {
      nextDepartmentId = null
    }
  }
  if (input.departmentId !== undefined || nextDepartmentId !== existing.departmentId) {
    data.departmentId = nextDepartmentId
  }

  // กฎเดียวกับแผนก: ย้ายสาขาแล้วตำแหน่งไม่ valid ให้เคลียร์ FK ไม่เก็บประวัติ
  let nextPositionId = input.positionId !== undefined ? input.positionId : existing.positionId
  if (nextPositionId) {
    if (input.positionId) {
      await assertPositionAllowed(db, companyId, nextPositionId, nextBranchIds)
    } else {
      const position = await db.position.findFirst({
        where: { id: nextPositionId, branch: { companyId } },
        select: { branchId: true, isActive: true },
      })
      if (!position || !position.isActive || !nextBranchIds.includes(position.branchId)) {
        nextPositionId = null
      }
    }
  }
  if (input.positionId !== undefined || nextPositionId !== existing.positionId) {
    data.positionId = nextPositionId
  }

  try {
    return await db.$transaction(async (tx) => {
      await tx.personnel.update({ where: { id: existing.id }, data })
      if (resolvedBranchIds) {
        await replacePersonnelBranchesFromIds(
          tx,
          existing.id,
          resolvedBranchIds,
          input.primaryBranchId && resolvedBranchIds.includes(input.primaryBranchId)
            ? input.primaryBranchId
            : null
        )
      }
      return {
        data: await tx.personnel.findUniqueOrThrow({
          where: { id: existing.id },
          include: personnelInclude,
        }),
      }
    })
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === "P2002") {
      throw new AppError("รหัสรายชื่อ (roster) ซ้ำในบริษัท", 409, "CONFLICT")
    }
    throw e
  }
}

export async function deletePersonnel(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canDeletePersonnel(params.roles)) throw new ForbiddenError()
  const existing = await findLivePersonnel(db, params)
  const row = await db.personnel.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), isActive: false },
    include: personnelInclude,
  })
  return { data: row }
}

export async function listPersonnelUserOptions(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; currentUserId?: string | null }
) {
  if (!canReadPersonnel(params.roles)) throw new ForbiddenError()
  const currentUserId = params.currentUserId?.trim() || null
  const users = await db.user.findMany({
    where: {
      companyId: params.companyId,
      deletedAt: null,
      isActive: true,
      OR: currentUserId ? [{ personnel: null }, { id: currentUserId }] : [{ personnel: null }],
    },
    select: { id: true, firstName: true, lastName: true, username: true, email: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 500,
  })
  return { data: users }
}

export async function listAccessiblePersonnelBranches(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[] }
) {
  if (!canReadPersonnel(params.roles)) throw new ForbiddenError()
  const isAdmin = isAdminInAnyBranch(params.roles)
  const allowed = getBranchIds(params.roles)
  const branches = await db.branch.findMany({
    where: {
      companyId: params.companyId,
      deletedAt: null,
      isActive: true,
      ...(isAdmin ? {} : { id: { in: allowed.length ? allowed : ["00000000-0000-0000-0000-000000000000"] } }),
    },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  })
  return { data: branches }
}

export async function listPersonnelDepartments(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; branchIds?: string[] | null }
) {
  if (!canReadPersonnel(params.roles)) throw new ForbiddenError()
  const isAdmin = isAdminInAnyBranch(params.roles)
  const allowed = getBranchIds(params.roles)
  const requested = params.branchIds?.filter(Boolean) ?? []
  const scope = isAdmin ? requested : requested.filter((id) => allowed.includes(id))
  const branchFilter = scope.length
    ? { id: { in: scope } }
    : isAdmin
      ? {}
      : { id: { in: allowed.length ? allowed : ["00000000-0000-0000-0000-000000000000"] } }

  const departments = await db.department.findMany({
    where: {
      isActive: true,
      branch: { companyId: params.companyId, deletedAt: null, isActive: true, ...branchFilter },
    },
    select: { id: true, name: true, code: true, branchId: true },
    orderBy: { name: "asc" },
  })
  return { data: departments }
}

export async function suggestNextRosterNo(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[] }
) {
  if (!canCreatePersonnel(params.roles) && !canReadPersonnel(params.roles)) {
    throw new ForbiddenError()
  }

  const rows = await db.personnel.findMany({
    where: { companyId: params.companyId },
    select: { rosterNo: true },
  })
  const occupied = new Set(rows.map((r) => r.rosterNo))
  let max = 0
  for (const r of rows) {
    const n = parseRosterNoSeq(r.rosterNo)
    if (n != null && n > max) max = n
  }

  const next = formatRosterNo(max + 1)
  if (occupied.has(next)) {
    throw new ValidationError("ไม่สามารถแนะนำรหัสได้ กรุณากรอกเอง")
  }
  return { data: { rosterNo: next } }
}
