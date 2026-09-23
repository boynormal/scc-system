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
      /** override การมองเห็นโมดูลรายบุคคล — undefined/null = ใช้ตาม Role */
      moduleAccess?: string[] | "all" | null
      /** true when this login belongs to a driver account */
      driverLogin?: boolean
    }
  }

  interface User {
    companyId: string
    roles: UserRole[]
    moduleAccess?: string[] | "all" | null
    driverLogin?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    companyId: string
    roles: UserRole[]
    moduleAccess?: string[] | "all" | null
    driverLogin?: boolean
  }
}
