import type { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { z } from "zod"

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  employeeCode: z.string().optional(),
  phone: z.string().optional(),
  branchId: z.string().uuid(),
  roleId: z.string().uuid(),
})

export const updateUserSchema = z
  .object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phone: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(8).optional(),
    branchId: z.string().uuid().optional(),
    roleId: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
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
        { employeeCode: { contains: params.search, mode: "insensitive" as never } },
      ],
    }),
  }

  const [data, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        employeeCode: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
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

export async function createUser(
  db: PrismaClient,
  params: { companyId: string; input: z.infer<typeof createUserSchema> }
) {
  const exists = await db.user.findUnique({ where: { email: params.input.email } })
  if (exists) return { error: { message: "Email already exists" }, status: 409 as const }

  const [branch, role] = await Promise.all([
    db.branch.findFirst({
      where: { id: params.input.branchId, companyId: params.companyId, deletedAt: null, isActive: true },
      select: { id: true },
    }),
    db.role.findFirst({
      where: { id: params.input.roleId, companyId: params.companyId },
      select: { id: true },
    }),
  ])
  if (!branch) return { error: { message: "Branch not found" }, status: 400 as const }
  if (!role) return { error: { message: "Role not found" }, status: 400 as const }

  const passwordHash = await bcrypt.hash(params.input.password, 12)
  const { branchId, roleId, password, ...userData } = params.input
  void password

  const user = await db.user.create({
    data: {
      ...userData,
      passwordHash,
      companyId: params.companyId,
      isActive: true,
      userBranchRoles: {
        create: { branchId, roleId },
      },
    },
  })

  return { data: { id: user.id, email: user.email } }
}

export async function getUserById(db: PrismaClient, params: { id: string; companyId: string }) {
  return db.user.findFirst({
    where: { id: params.id, companyId: params.companyId, deletedAt: null },
    select: {
      id: true,
      employeeCode: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      isActive: true,
      lastLoginAt: true,
      avatarUrl: true,
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
  })
  if (!user) return { error: "Not found" as const, status: 404 as const }

  const { password, branchId, roleId, ...rest } = params.input

  if (branchId && roleId) {
    const [branch, role] = await Promise.all([
      db.branch.findFirst({
        where: { id: branchId, companyId: params.companyId, deletedAt: null, isActive: true },
        select: { id: true },
      }),
      db.role.findFirst({
        where: { id: roleId, companyId: params.companyId },
        select: { id: true },
      }),
    ])
    if (!branch) return { error: { message: "Branch not found" }, status: 400 as const }
    if (!role) return { error: { message: "Role not found" }, status: 400 as const }

    await db.$transaction([
      db.userBranchRole.deleteMany({ where: { userId: params.id } }),
      db.userBranchRole.create({
        data: { userId: params.id, branchId, roleId, assignedBy: params.assignedBy },
      }),
    ])
  }

  const updated = await db.user.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(password && { passwordHash: await bcrypt.hash(password, 12) }),
    },
  })

  return { data: { id: updated.id } }
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
