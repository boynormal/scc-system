import { Prisma, type PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { z } from "zod"

/** Prisma ต้องใช้ Prisma.DbNull แทน `null` ธรรมดา เพื่อเซ็ตคอลัมน์ Json ให้เป็น SQL NULL จริง ๆ */
function toModuleAccessJson(
  value: string[] | "all" | null | undefined
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined
  if (value === null) return Prisma.DbNull
  return value
}

/** null/undefined = มองเห็นตามสิทธิ์อ่านของ Role, "all" = ทุกโมดูล, array = เฉพาะโมดูลที่ระบุ */
const moduleAccessSchema = z.union([z.literal("all"), z.array(z.string())]).nullable().optional()

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._]{3,50}$/, "Username ต้องเป็น a-z, 0-9, . หรือ _ ความยาว 3–50 ตัว")

export const branchAssignmentInputSchema = z.object({
  id: z.string().uuid().optional(),
  branchId: z.string().uuid(),
  roleId: z.string().uuid(),
})

function issueDuplicateBranches(
  assignments: { branchId: string }[],
  ctx: z.RefinementCtx,
  path: (string | number)[]
) {
  const seen = new Set<string>()
  for (let i = 0; i < assignments.length; i++) {
    const branchId = assignments[i].branchId
    if (seen.has(branchId)) {
      ctx.addIssue({
        code: "custom",
        message: "ไม่สามารถกำหนด Role ซ้ำในสาขาเดียวกันได้",
        path: [...path, i, "branchId"],
      })
    }
    seen.add(branchId)
  }
}

export const createUserSchema = z
  .object({
    username: usernameSchema,
    email: z.string().email(),
    password: z.string().min(8),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    employeeCode: z.string().optional(),
    phone: z.string().optional(),
    branchId: z.string().uuid().optional(),
    roleId: z.string().uuid().optional(),
    branchAssignments: z.array(branchAssignmentInputSchema).min(1).optional(),
    moduleAccess: moduleAccessSchema,
  })
  .superRefine((data, ctx) => {
    if (data.branchAssignments && data.branchAssignments.length > 0) {
      issueDuplicateBranches(data.branchAssignments, ctx, ["branchAssignments"])
      return
    }
    if (!data.branchId) {
      ctx.addIssue({ code: "custom", message: "กรุณาเลือกสาขา", path: ["branchId"] })
    }
    if (!data.roleId) {
      ctx.addIssue({ code: "custom", message: "กรุณาเลือก Role", path: ["roleId"] })
    }
  })

export const updateUserSchema = z
  .object({
    username: usernameSchema.optional(),
    email: z.string().email().optional(),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    employeeCode: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(8).optional(),
    branchId: z.string().uuid().optional(),
    roleId: z.string().uuid().optional(),
    /** ระบุแถว user_branch_roles ที่ต้องการแก้ไข เมื่อผู้ใช้มีมากกว่า 1 สาขา/role — ป้องกันการลบสิทธิ์สาขาอื่นโดยไม่ตั้งใจ */
    userBranchRoleId: z.string().uuid().optional(),
    branchAssignments: z.array(branchAssignmentInputSchema).optional(),
    moduleAccess: moduleAccessSchema,
  })
  .superRefine((data, ctx) => {
    if (data.branchAssignments !== undefined) {
      if (data.branchAssignments.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "ต้องมีสิทธิ์อย่างน้อย 1 สาขา",
          path: ["branchAssignments"],
        })
        return
      }
      issueDuplicateBranches(data.branchAssignments, ctx, ["branchAssignments"])
      return
    }
    const hasBranch = data.branchId !== undefined
    const hasRole = data.roleId !== undefined
    if (hasBranch !== hasRole) {
      ctx.addIssue({
        code: "custom",
        message: "branchId and roleId must be provided together",
        path: ["branchId"],
      })
    }
  })

export type BranchAssignmentInput = z.infer<typeof branchAssignmentInputSchema>

export function resolveCreateAssignments(
  input: z.infer<typeof createUserSchema>
): { branchId: string; roleId: string }[] {
  if (input.branchAssignments && input.branchAssignments.length > 0) {
    return input.branchAssignments.map(({ branchId, roleId }) => ({ branchId, roleId }))
  }
  return [{ branchId: input.branchId as string, roleId: input.roleId as string }]
}

export function assignmentBranchIdsFromCreateInput(input: z.infer<typeof createUserSchema>): string[] {
  return [...new Set(resolveCreateAssignments(input).map((a) => a.branchId))]
}

export function assignmentBranchIdsFromUpdateInput(input: z.infer<typeof updateUserSchema>): string[] {
  if (input.branchAssignments) {
    return [...new Set(input.branchAssignments.map((a) => a.branchId))]
  }
  return input.branchId ? [input.branchId] : []
}

export async function listUsers(
  db: PrismaClient,
  params: { companyId: string; search?: string | null; page: number; pageSize: number }
) {
  const where = {
    companyId: params.companyId,
    deletedAt: null,
    ...(params.search && {
      OR: [
        { firstName: { contains: params.search, mode: "insensitive" as never } },
        { lastName: { contains: params.search, mode: "insensitive" as never } },
        { email: { contains: params.search, mode: "insensitive" as never } },
        { username: { contains: params.search, mode: "insensitive" as never } },
        { employeeCode: { contains: params.search, mode: "insensitive" as never } },
      ],
    }),
  }

  const [data, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        employeeCode: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        moduleAccess: true,
        userBranchRoles: {
          include: {
            branch: { select: { id: true, name: true } },
            role: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { firstName: "asc" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    db.user.count({ where }),
  ])

  return {
    data,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.ceil(total / params.pageSize),
  }
}

type ServiceError = { error: { message: string }; status: 400 | 409 }

async function assertAssignmentsExist(
  db: PrismaClient,
  companyId: string,
  assignments: { branchId: string; roleId: string }[]
): Promise<ServiceError | null> {
  const branchIds = [...new Set(assignments.map((a) => a.branchId))]
  const roleIds = [...new Set(assignments.map((a) => a.roleId))]
  const [branches, roles] = await Promise.all([
    db.branch.findMany({
      where: { id: { in: branchIds }, companyId, deletedAt: null, isActive: true },
      select: { id: true },
    }),
    db.role.findMany({
      where: { id: { in: roleIds }, companyId },
      select: { id: true },
    }),
  ])
  if (branches.length !== branchIds.length) return { error: { message: "Branch not found" }, status: 400 }
  if (roles.length !== roleIds.length) return { error: { message: "Role not found" }, status: 400 }
  return null
}

export async function createUser(
  db: PrismaClient,
  params: { companyId: string; input: z.infer<typeof createUserSchema> }
) {
  const username = params.input.username
  const existsUsername = await db.user.findUnique({ where: { username } })
  if (existsUsername) {
    return { error: { message: "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว" }, status: 409 as const }
  }

  const exists = await db.user.findUnique({ where: { email: params.input.email } })
  if (exists) return { error: { message: "อีเมลนี้ถูกใช้งานแล้ว" }, status: 409 as const }

  const assignments = resolveCreateAssignments(params.input)
  const assignmentError = await assertAssignmentsExist(db, params.companyId, assignments)
  if (assignmentError) return assignmentError

  if (params.input.employeeCode) {
    const dupCode = await db.user.findFirst({
      where: { companyId: params.companyId, employeeCode: params.input.employeeCode, deletedAt: null },
      select: { id: true },
    })
    if (dupCode) {
      return { error: { message: "รหัสพนักงานนี้ถูกใช้แล้วในบริษัทนี้" }, status: 409 as const }
    }
  }

  const passwordHash = await bcrypt.hash(params.input.password, 12)
  const { branchId, roleId, branchAssignments, password, moduleAccess, ...userData } = params.input
  void branchId
  void roleId
  void branchAssignments
  void password

  const user = await db.user.create({
    data: {
      ...userData,
      username,
      moduleAccess: toModuleAccessJson(moduleAccess),
      passwordHash,
      companyId: params.companyId,
      isActive: true,
      userBranchRoles: {
        create: assignments.map((a) => ({ branchId: a.branchId, roleId: a.roleId })),
      },
    },
  })

  return { data: { id: user.id, email: user.email, username: user.username } }
}

export async function getUserById(db: PrismaClient, params: { id: string; companyId: string }) {
  return db.user.findFirst({
    where: { id: params.id, companyId: params.companyId, deletedAt: null },
    select: {
      id: true,
      username: true,
      employeeCode: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      isActive: true,
      lastLoginAt: true,
      avatarUrl: true,
      moduleAccess: true,
      userBranchRoles: {
        include: {
          branch: { select: { id: true, name: true } },
          role: { select: { id: true, name: true } },
        },
      },
    },
  })
}

export async function updateUser(
  db: PrismaClient,
  params: {
    id: string
    companyId: string
    assignedBy: string
    input: z.infer<typeof updateUserSchema>
  }
) {
  const user = await db.user.findFirst({
    where: { id: params.id, companyId: params.companyId, deletedAt: null },
    include: { userBranchRoles: { select: { id: true, branchId: true, roleId: true } } },
  })
  if (!user) return { error: "Not found" as const, status: 404 as const }

  const {
    password,
    branchId,
    roleId,
    userBranchRoleId,
    branchAssignments,
    moduleAccess,
    email,
    username,
    employeeCode: employeeCodeRaw,
    ...rest
  } = params.input

  const employeeCode =
    employeeCodeRaw === undefined
      ? undefined
      : employeeCodeRaw === null || employeeCodeRaw.trim() === ""
        ? null
        : employeeCodeRaw.trim()

  if (username && username !== user.username) {
    const dupUsername = await db.user.findFirst({
      where: { username, id: { not: params.id } },
      select: { id: true },
    })
    if (dupUsername) {
      return { error: { message: "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว" }, status: 409 as const }
    }
  }

  if (email && email !== user.email) {
    const dupEmail = await db.user.findFirst({
      where: { email, id: { not: params.id } },
      select: { id: true },
    })
    if (dupEmail) {
      return { error: { message: "อีเมลนี้ถูกใช้งานแล้ว" }, status: 409 as const }
    }
  }

  if (employeeCode !== undefined && employeeCode !== user.employeeCode) {
    if (employeeCode) {
      const dupCode = await db.user.findFirst({
        where: {
          companyId: params.companyId,
          employeeCode,
          deletedAt: null,
          id: { not: params.id },
        },
        select: { id: true },
      })
      if (dupCode) {
        return { error: { message: "รหัสพนักงานนี้ถูกใช้แล้วในบริษัทนี้" }, status: 409 as const }
      }
    }
  }

  if (branchAssignments) {
    const incoming = branchAssignments.map(({ branchId: bid, roleId: rid }) => ({
      branchId: bid,
      roleId: rid,
    }))
    const assignmentError = await assertAssignmentsExist(db, params.companyId, incoming)
    if (assignmentError) return assignmentError

    await db.$transaction(async (tx) => {
      await tx.userBranchRole.deleteMany({ where: { userId: params.id } })
      await tx.userBranchRole.createMany({
        data: incoming.map((a) => ({
          userId: params.id,
          branchId: a.branchId,
          roleId: a.roleId,
          assignedBy: params.assignedBy,
        })),
      })
    })
  } else if (branchId && roleId) {
    const assignmentError = await assertAssignmentsExist(db, params.companyId, [{ branchId, roleId }])
    if (assignmentError) return assignmentError

    const existingRoles = user.userBranchRoles
    const otherOnSameBranch = existingRoles.find(
      (r) => r.branchId === branchId && r.id !== (userBranchRoleId ?? existingRoles[0]?.id)
    )
    if (otherOnSameBranch) {
      return { error: { message: "ไม่สามารถกำหนด Role ซ้ำในสาขาเดียวกันได้" }, status: 400 as const }
    }

    if (userBranchRoleId) {
      const target = existingRoles.find((r) => r.id === userBranchRoleId)
      if (!target) {
        return { error: { message: "Branch/role assignment not found" }, status: 400 as const }
      }
      await db.userBranchRole.update({
        where: { id: userBranchRoleId },
        data: { branchId, roleId, assignedBy: params.assignedBy, assignedAt: new Date() },
      })
    } else if (existingRoles.length === 0) {
      await db.userBranchRole.create({
        data: { userId: params.id, branchId, roleId, assignedBy: params.assignedBy },
      })
    } else if (existingRoles.length === 1) {
      await db.userBranchRole.update({
        where: { id: existingRoles[0].id },
        data: { branchId, roleId, assignedBy: params.assignedBy, assignedAt: new Date() },
      })
    } else {
      return {
        error: {
          message:
            "ผู้ใช้นี้มีสิทธิ์มากกว่า 1 สาขา กรุณาระบุ userBranchRoleId ที่ต้องการแก้ไข เพื่อป้องกันการลบสิทธิ์สาขาอื่นโดยไม่ตั้งใจ",
        },
        status: 409 as const,
      }
    }
  }

  const updated = await db.user.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(username && { username }),
      ...(email && { email }),
      ...(employeeCode !== undefined && { employeeCode }),
      ...(moduleAccess !== undefined && { moduleAccess: toModuleAccessJson(moduleAccess) }),
      ...(password && { passwordHash: await bcrypt.hash(password, 12) }),
    },
  })

  return { data: { id: updated.id, email: updated.email, username: updated.username } }
}

export async function deactivateUser(
  db: PrismaClient,
  params: { id: string; companyId: string; currentUserId: string }
) {
  if (params.id === params.currentUserId) {
    return { error: { message: "Cannot delete your own account" }, status: 400 as const }
  }

  const user = await db.user.findFirst({
    where: { id: params.id, companyId: params.companyId, deletedAt: null },
  })
  if (!user) return { error: "Not found" as const, status: 404 as const }

  await db.user.update({ where: { id: params.id }, data: { deletedAt: new Date(), isActive: false } })
  return { success: true }
}
