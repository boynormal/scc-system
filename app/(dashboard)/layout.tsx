import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Sidebar from "@/components/layout/sidebar"
import Header from "@/components/layout/header"
import { buildDashboardNav } from "@/shared/navigation/buildDashboardNav"
import { parseCompanyNavPreferences } from "@/shared/navigation/companyNavPreferences"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { settings: true },
  })
  const navPreferences = parseCompanyNavPreferences(company?.settings ?? null)
  const navItems = buildDashboardNav(session.user.roles, navPreferences)

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar navItems={navItems} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={session.user} navItems={navItems} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
