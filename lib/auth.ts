import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import authConfig from "@/lib/auth.config"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email, deletedAt: null, isActive: true },
          include: {
            userBranchRoles: {
              include: { role: true, branch: true },
            },
          },
        })

        if (!user || !user.passwordHash) return null

        const isValid = await bcrypt.compare(parsed.data.password, user.passwordHash)
        if (!isValid) return null

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          companyId: user.companyId,
          moduleAccess: user.moduleAccess,
          roles: user.userBranchRoles.map((r) => ({
            branchId: r.branchId,
            branchName: r.branch.name,
            roleName: r.role.name,
            permissions: r.role.permissions,
          })),
        } as never
      },
    }),
  ],
})
