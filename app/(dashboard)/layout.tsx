import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Sidebar from "@/components/layout/sidebar"
import Header from "@/components/layout/header"
import { APPEARANCE_COOKIE, resolveAppearance } from "@/shared/appearance"
import { buildDashboardNav } from "@/shared/navigation/buildDashboardNav"
import { parseCompanyNavPreferences } from "@/shared/navigation/companyNavPreferences"
import { translateNavTree } from "@/shared/navigation/translateNav"
import { cn } from "@/lib/utils"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { settings: true, logoUrl: true },
  })
  const navPreferences = parseCompanyNavPreferences(company?.settings ?? null)
  const tNav = await getTranslations("nav")
  const navItems = translateNavTree(
    buildDashboardNav(session.user.roles, navPreferences, session.user.moduleAccess),
    (key) => tNav(key)
  )
  const cookieStore = await cookies()
  const appearance = resolveAppearance(
    cookieStore.get(APPEARANCE_COOKIE)?.value,
    navPreferences.appearance
  )
  const isDark = appearance === "dark"

  return (
    <div className={cn("relative flex h-screen bg-glass-ambient", isDark && "dark")}>
      <Sidebar
        navItems={navItems}
        productLineImageOverrides={navPreferences.productLineImageOverrides}
        moduleImageOverrides={navPreferences.moduleImageOverrides}
        logoUrl={company?.logoUrl}
      />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header user={session.user} navItems={navItems} appearance={appearance} />
        <main className="flex-1 overflow-y-auto p-6 text-foreground">{children}</main>
      </div>
    </div>
  )
}
