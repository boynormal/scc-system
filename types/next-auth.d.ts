import "next-auth"
import type { UserRole } from "@/lib/permissions"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      image?: string | null
      companyId: string
      roles: UserRole[]
    }
  }

  interface User {
    companyId: string
    roles: UserRole[]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    companyId: string
    roles: UserRole[]
  }
}
