import type { NextAuthConfig } from "next-auth"

const authConfig: NextAuthConfig = {
  providers: [],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.companyId = (user as never as { companyId: string }).companyId
        token.roles = (user as never as { roles: unknown[] }).roles
        token.moduleAccess = (user as never as { moduleAccess?: unknown }).moduleAccess as never
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.companyId = token.companyId as string
        session.user.roles = token.roles as never[]
        session.user.moduleAccess = token.moduleAccess as never
      }
      return session
    },
  },
}

export default authConfig
