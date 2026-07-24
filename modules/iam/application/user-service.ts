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

/** null/undefined = ใช้ moduleAccess ตาม Role, "all" = ทุกโมดูล, array = เฉพาะโมดูลที่ระบุ */
const moduleAccessSchema = z.union([z.literal("all"), z.array(z.string())]).nullable().optional()

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  employeeCode: z.string().optional(),
  phone: z.string().optional(),
  branchId: z.string().uuid(),
  roleId: z.string().uuid(),
  moduleAccess: moduleAccessSchema,
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
    /** ระบุแถว user_branch_roles ที่ต้องการแก้ไข เมื่อผู้ใช้มีมากกว่า 1 สาขา/role — ป้องกันการลบสิทธิ์สาขาอื่นโดยไม่ตั้งใจ */
    userBranchRoleId: z.string().uuid().optional(),
    moduleAccess: moduleAccessSchema,
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
  const { branchId, roleId, password, moduleAccess, ...userData } = params.input
  void password

  const user = await db.user.create({
    data: {
      ...userData,
      moduleAccess: toModuleAccessJson(moduleAccess),
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
    include: { userBranchRoles: { select: { id: true } } },
  })
  if (!user) return { error: "Not found" as const, status: 404 as const }

  const { password, branchId, roleId, userBranchRoleId, moduleAccess, ...rest } = params.input

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

    const existingRoles = user.userBranchRoles

    if (userBranchRoleId) {
      // แก้ไขเฉพาะแถวที่ระบุ — ไม่กระทบ (branch, role) อื่นของ user คนนี้
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
      // กรณีปกติ (user มีสาขา/role เดียว) — อัปเดตแถวเดิมในที่ ไม่ลบ+สร้างใหม่
      await db.userBranchRole.update({
        where: { id: existingRoles[0].id },
        data: { branchId, roleId, assignedBy: params.assignedBy, assignedAt: new Date() },
      })
    } else {
      // user มีหลายสาขา/role — ต้องระบุ userBranchRoleId ให้ชัดเจน ป้องกันการลบสิทธิ์สาขาอื่นโดยไม่ตั้งใจ
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
      ...(moduleAccess !== undefined && { moduleAccess: toModuleAccessJson(moduleAccess) }),
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
