import { z } from "zod"
import type { PrismaClient, Prisma } from "@prisma/client"
import { AppError, ForbiddenError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { replacePersonnelBranchesFromIds } from "./personnel-branch-utils"

export const createPersonnelSchema = z
  .object({
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
  })
  .superRefine((data, ctx) => {
    if (data.primaryBranchId && data.branchIds?.length) {
      if (!data.branchIds.includes(data.primaryBranchId)) {
        ctx.addIssue({
          code: "custom",
          message: "primaryBranchId ต้องอยู่ใน branchIds",
          path: ["primaryBranchId"],
        })
      }
    }
  })

export type CreatePersonnelInput = z.infer<typeof createPersonnelSchema>

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
    page: number
    pageSize: number
  }
) {
  if (!canReadPersonnel(params.roles)) throw new ForbiddenError()

  const { companyId, roles, branchId: branchIdParam = null, search, page, pageSize } = params

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
      include: {
        branch: { select: { name: true, code: true } },
        branchAssignments: {
          include: { branch: { select: { name: true, code: true, id: true } } },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
      },
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

  const { branchId, primaryBranchId, rosterNo, displayName, jobGroup, firstName, lastName, idCardNo, phone, address, notes } = input

  const resolvedBranchIds = resolveBranchIdList(input)
  const primary = resolvePrimaryFromList(resolvedBranchIds, primaryBranchId ?? null) ?? branchId ?? null

  await assertBranchesAllowed(db, companyId, resolvedBranchIds, roles)

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
        include: {
          branch: { select: { name: true, code: true } },
          branchAssignments: {
            include: { branch: { select: { name: true, code: true } } },
            orderBy: [{ isPrimary: "desc" }],
          },
        },
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
