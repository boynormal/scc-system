import { z } from "zod"
import type { PrismaClient, Prisma } from "@prisma/client"
import { AppError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { readBranchSharing, type BranchShareAction } from "@/shared/permissions/branch-sharing"
import { ensurePersonnelBranch, replacePersonnelBranchesFromIds } from "./personnel-branch-utils"
import { isPersonnelDateTime, parsePersonnelDateTime, personnelDateTimeReached } from "./personnel-date-time"

const optionalDate = z
  .string()
  .nullable()
  .optional()
  .transform((value) => {
    const text = value?.trim() ?? ""
    return text.length > 0 ? text : null
  })
  .refine((value) => value == null || /^\d{4}-\d{2}-\d{2}$/.test(value), "วันที่ไม่ถูกต้อง")

const optionalDateTime = z
  .string()
  .nullable()
  .optional()
  .transform((value) => {
    const text = value?.trim() ?? ""
    return text.length > 0 ? text : null
  })
  .refine((value) => isPersonnelDateTime(value), "วันและเวลาไม่ถูกต้อง")

const optionalGender = z
  .enum(["MALE", "FEMALE", "UNSPECIFIED"])
  .nullable()
  .optional()
  .or(z.literal(""))
  .transform((value) => (value ? value : null))

const optionalNationality = z
  .enum(["THAI", "MYANMAR", "OTHER"])
  .nullable()
  .optional()
  .or(z.literal(""))
  .transform((value) => (value ? value : null))

const optionalExitKind = z
  .enum(["VOLUNTARY", "INVOLUNTARY"])
  .nullable()
  .optional()
  .or(z.literal(""))
  .transform((value) => (value ? value : null))

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
  jobGroupId: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  birthDate: optionalDate,
  startDate: optionalDateTime,
  gender: optionalGender,
  nationality: optionalNationality,
  endDate: optionalDateTime,
  exitKind: optionalExitKind,
})

function refinePrimaryBranch(
  data: { primaryBranchId?: string; branchIds?: string[]; endDate?: string | null; exitKind?: string | null },
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
  if (data.endDate && !data.exitKind) {
    ctx.addIssue({
      code: "custom",
      message: "ต้องระบุเหตุที่ออก",
      path: ["exitKind"],
    })
  }
}

function toDbDate(value: string | null | undefined): Date | null {
  if (!value) return null
  return new Date(`${value}T00:00:00.000Z`)
}

function toDbDateTime(value: string | null | undefined): Date | null {
  return parsePersonnelDateTime(value)
}

/** ไม่ส่ง rosterNo = ให้ระบบรันเลขถัดไปของบริษัท */
export const createPersonnelSchema = personnelFieldsSchema
  .extend({
    rosterNo: z
      .string()
      .max(30)
      .optional()
      .transform((v) => v?.trim() || undefined),
  })
  .superRefine(refinePrimaryBranch)

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
  department: { select: { id: true, name: true, code: true } },
  jobGroupRef: { select: { id: true, name: true } },
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

/** ส่งเฉพาะ primaryBranchId = ตั้งสาขาหลัก และคงสาขาที่ผูกเลขสแกนเพิ่มไว้ */
function promoteBranchIdFromUpdate(body: UpdatePersonnelInput): string | null {
  if (body.branchIds !== undefined || body.branchId !== undefined) return null
  return body.primaryBranchId ?? null
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
  departmentId: string
) {
  const dept = await db.department.findFirst({
    where: { id: departmentId, isActive: true, companyId },
    select: { id: true },
  })
  if (!dept) throw new ValidationError("แผนกไม่ถูกต้อง")
}

async function assertJobGroupAllowed(
  db: PrismaClient | Prisma.TransactionClient,
  companyId: string,
  jobGroupId: string
) {
  const group = await db.jobGroup.findFirst({
    where: { id: jobGroupId, isActive: true, companyId },
    select: { id: true },
  })
  if (!group) throw new ValidationError("กลุ่มงานไม่ถูกต้อง")
}

export function personnelLegalName(person: {
  firstName?: string | null
  lastName?: string | null
  displayName: string
}): string {
  const legal = [person.firstName, person.lastName]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join(" ")
  const knownAs = person.displayName.trim()
  if (!legal) return knownAs
  if (!knownAs || knownAs === legal) return legal
  return `${legal} (${knownAs})`
}

async function personnelShared(db: PrismaClient, companyId: string, action: BranchShareAction) {
  return (await readBranchSharing(db, companyId)).personnel[action]
}

async function findLivePersonnel(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string },
  action: BranchShareAction = "view"
) {
  const allowed = getBranchIds(params.roles)
  const isAdmin = isAdminInAnyBranch(params.roles) || (await personnelShared(db, params.companyId, action))
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
  roles: UserRole[],
  shared = false
): Promise<void> {
  if (branchIds.length === 0) return
  const rows = await db.branch.findMany({
    where: { id: { in: branchIds }, companyId, deletedAt: null, isActive: true },
    select: { id: true },
  })
  if (rows.length !== branchIds.length) {
    throw new ValidationError("สาขาไม่ถูกต้อง")
  }
  if (!shared && !isAdminInAnyBranch(roles)) {
    const allowed = new Set(getBranchIds(roles))
    for (const id of branchIds) {
      if (!allowed.has(id)) {
        throw new ForbiddenError("ไม่มีสิทธิ์ในสาขาที่เลือก")
      }
    }
  }
}

function listedOnBranch(branchId: string): Prisma.PersonnelWhereInput {
  return {
    OR: [
      { branchAssignments: { some: { branchId, isPrimary: true } } },
      { branchId, branchAssignments: { none: { isPrimary: true } } },
    ],
  }
}

export function personnelBranchWhereForRoles(
  isAdmin: boolean,
  allowed: string[],
  branchIdParam: string | null
): Prisma.PersonnelWhereInput | null {
  if (isAdmin) {
    if (!branchIdParam) return null
    return listedOnBranch(branchIdParam)
  }
  if (allowed.length === 0) return { id: "00000000-0000-0000-0000-000000000000" }
  if (branchIdParam) {
    if (!allowed.includes(branchIdParam)) return null
    return listedOnBranch(branchIdParam)
  }
  return {
    OR: [
      { branchId: { in: allowed } },
      { branchAssignments: { some: { branchId: { in: allowed } } } },
    ],
  }
}

/** จำนวนคนที่ยังใช้งาน แยกตามสาขาหลักที่แสดงในรายการ */
export async function countActivePersonnelByBranch(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; branchIds: string[] }
): Promise<Record<string, number>> {
  if (!canReadPersonnel(params.roles)) throw new ForbiddenError()
  const ids = [...new Set(params.branchIds)]
  const counts: Record<string, number> = {}
  for (const id of ids) counts[id] = 0
  if (ids.length === 0) return counts

  const rows = await db.personnel.findMany({
    where: {
      companyId: params.companyId,
      deletedAt: null,
      isActive: true,
      OR: ids.map((branchId) => listedOnBranch(branchId)),
    },
    select: {
      branchId: true,
      branchAssignments: { where: { isPrimary: true }, select: { branchId: true }, take: 1 },
    },
  })

  for (const row of rows) {
    const home = row.branchAssignments[0]?.branchId ?? row.branchId
    if (home && counts[home] != null) counts[home] += 1
  }
  return counts
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
  const isAdmin = isAdminInAnyBranch(roles) || (await personnelShared(db, companyId, "view"))
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
    jobGroupId,
    birthDate,
    startDate,
    gender,
    nationality,
    endDate,
    exitKind,
  } = input

  const resolvedBranchIds = resolveBranchIdList(input)
  const primary = resolvePrimaryFromList(resolvedBranchIds, primaryBranchId ?? null) ?? branchId ?? null

  await assertBranchesAllowed(
    db,
    companyId,
    resolvedBranchIds,
    roles,
    await personnelShared(db, companyId, "create")
  )
  if (userId) await assertUserLinkAllowed(db, companyId, userId)
  if (departmentId) await assertDepartmentAllowed(db, companyId, departmentId)
  if (jobGroupId) await assertJobGroupAllowed(db, companyId, jobGroupId)

  if (resolvedBranchIds.length === 0 && !isAdminInAnyBranch(roles)) {
    const allowed = getBranchIds(roles)
    if (allowed.length === 0) throw new ForbiddenError()
  }

  const autoRoster = !rosterNo
  for (let attempt = 0; ; attempt++) {
    const nextRosterNo = rosterNo ?? (await nextCompanyRosterNo(db, companyId))
    try {
      return await insertPersonnel(nextRosterNo)
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code
      if (code !== "P2002") throw e
      if (autoRoster && attempt < 4) continue
      throw new AppError("รหัสรายชื่อ (roster) ซ้ำในบริษัท", 409, "CONFLICT")
    }
  }

  function insertPersonnel(nextRosterNo: string) {
    return db.$transaction(async (tx) => {
      const created = await tx.personnel.create({
        data: {
          companyId,
          branchId: primary,
          rosterNo: nextRosterNo,
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
          jobGroupId: jobGroupId ?? null,
          birthDate: toDbDate(birthDate),
          startDate: toDbDateTime(startDate),
          gender,
          nationality,
          endDate: toDbDateTime(endDate),
          exitKind: endDate ? exitKind : null,
          ...(personnelDateTimeReached(endDate) ? { isActive: false } : {}),
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

  const existing = await findLivePersonnel(db, { companyId, roles, id }, "edit")

  const resolvedBranchIds = resolveBranchIdListFromUpdate(input)
  const promoteBranchId = promoteBranchIdFromUpdate(input)
  if (resolvedBranchIds) {
    await assertBranchesAllowed(db, companyId, resolvedBranchIds, roles, await personnelShared(db, companyId, "edit"))
  }
  if (promoteBranchId) {
    await assertBranchesAllowed(
      db,
      companyId,
      [promoteBranchId],
      roles,
      await personnelShared(db, companyId, "edit")
    )
  }
  if (input.userId) {
    await assertUserLinkAllowed(db, companyId, input.userId, existing.id)
  }

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
  if (personnelDateTimeReached(input.endDate)) data.isActive = false
  if (input.userId !== undefined) data.userId = input.userId
  if (input.birthDate !== undefined) data.birthDate = toDbDate(input.birthDate)
  if (input.startDate !== undefined) data.startDate = toDbDateTime(input.startDate)
  if (input.gender !== undefined) data.gender = input.gender
  if (input.nationality !== undefined) data.nationality = input.nationality
  if (input.endDate !== undefined) data.endDate = toDbDateTime(input.endDate)
  if (input.exitKind !== undefined || input.endDate !== undefined) {
    data.exitKind = input.endDate ? input.exitKind ?? null : null
  }

  if (resolvedBranchIds) {
    data.branchId = resolvePrimaryFromList(resolvedBranchIds, input.primaryBranchId ?? null)
  } else if (promoteBranchId) {
    data.branchId = promoteBranchId
  }

  let nextDepartmentId = input.departmentId !== undefined ? input.departmentId : existing.departmentId
  if (nextDepartmentId) {
    if (input.departmentId) {
      await assertDepartmentAllowed(db, companyId, nextDepartmentId)
    } else {
      const dept = await db.department.findFirst({
        where: { id: nextDepartmentId, companyId },
        select: { isActive: true },
      })
      if (!dept || !dept.isActive) nextDepartmentId = null
    }
  }
  if (input.departmentId !== undefined || nextDepartmentId !== existing.departmentId) {
    data.departmentId = nextDepartmentId
  }

  if (input.jobGroupId !== undefined) {
    if (input.jobGroupId) await assertJobGroupAllowed(db, companyId, input.jobGroupId)
    data.jobGroupId = input.jobGroupId
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
      } else if (promoteBranchId) {
        await ensurePersonnelBranch(tx, existing.id, promoteBranchId, { makePrimary: true })
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
  const existing = await findLivePersonnel(db, params, "delete")
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
  const share = await readBranchSharing(db, params.companyId)
  const isAdmin =
    isAdminInAnyBranch(params.roles) || share.personnel.view || share.personnel.create || share.personnel.edit
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
  params: { companyId: string; roles: UserRole[] }
) {
  if (!canReadPersonnel(params.roles)) throw new ForbiddenError()

  const departments = await db.department.findMany({
    where: {
      isActive: true,
      companyId: params.companyId,
    },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  })
  return { data: departments }
}

export async function listPersonnelJobGroups(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[] }
) {
  if (!canReadPersonnel(params.roles)) throw new ForbiddenError()

  const jobGroups = await db.jobGroup.findMany({
    where: { isActive: true, companyId: params.companyId },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  })
  return { data: jobGroups }
}

export async function suggestNextRosterNo(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[] }
) {
  if (!canCreatePersonnel(params.roles) && !canReadPersonnel(params.roles)) {
    throw new ForbiddenError()
  }
  return { data: { rosterNo: await nextCompanyRosterNo(db, params.companyId) } }
}

/** รวมแถวที่ soft-delete ด้วย เพราะรหัสเดิมยังจองไว้ให้คนที่จ้างกลับ */
async function nextCompanyRosterNo(db: PrismaClient, companyId: string): Promise<string> {
  const rows = await db.personnel.findMany({
    where: { companyId },
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
    throw new ValidationError("ไม่สามารถสร้างรหัสรายชื่ออัตโนมัติได้")
  }
  return next
}
