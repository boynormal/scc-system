import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Sidebar from "@/components/layout/sidebar"
import Header from "@/components/layout/header"
import { buildDashboardNav } from "@/shared/navigation/buildDashboardNav"
import { parseCompanyNavPreferences } from "@/shared/navigation/companyNavPreferences"
import { cn } from "@/lib/utils"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { settings: true },
  })
  const navPreferences = parseCompanyNavPreferences(company?.settings ?? null)
  const navItems = buildDashboardNav(session.user.roles, navPreferences, session.user.moduleAccess)
  const isDark = navPreferences.appearance === "dark"

  return (
    <div className={cn("relative flex h-screen bg-glass-ambient", isDark && "dark")}>
      <Sidebar
        navItems={navItems}
        productLineImageOverrides={navPreferences.productLineImageOverrides}
        moduleImageOverrides={navPreferences.moduleImageOverrides}
      />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header user={session.user} navItems={navItems} />
        <main className="flex-1 overflow-y-auto p-6 text-foreground">{children}</main>
      </div>
    </div>
  )
}
