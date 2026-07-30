import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTranslations } from "next-intl/server"
import { IpadLauncher } from "@/components/apps/ipad-launcher"
import { buildDashboardNav, flattenNavForLauncher } from "@/shared/navigation"
import { parseCompanyNavPreferences } from "@/shared/navigation/companyNavPreferences"
import { translateNavTree } from "@/shared/navigation/translateNav"
import { decimalToNumber } from "@/shared/transport/coordinates"
import { redirect } from "next/navigation"

/** หน้าหลัก — launcher แบบ iPad */
export default async function AppsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const companyId = session.user.companyId

  const [company, branches] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { settings: true },
    }),
    prisma.branch.findMany({
      where: { companyId, deletedAt: null, isActive: true },
      select: { id: true, name: true, latitude: true, longitude: true },
      orderBy: { name: "asc" },
    }),
  ])

  const navPreferences = parseCompanyNavPreferences(company?.settings ?? null)
  const tNav = await getTranslations("nav")
  const navItems = translateNavTree(
    buildDashboardNav(session.user.roles, navPreferences, session.user.moduleAccess),
    (key) => tNav(key)
  )
  const apps = flattenNavForLauncher(navItems)

  const weatherBranches = branches.map((b) => ({
    id: b.id,
    name: b.name,
    latitude: decimalToNumber(b.latitude),
    longitude: decimalToNumber(b.longitude),
  }))

  return (
    <div className="-m-6 h-[calc(100vh-3.5rem)] overflow-hidden">
      <IpadLauncher
        apps={apps}
        pinnedModuleIds={navPreferences.pinnedModuleIds}
        hiddenDepartmentIds={navPreferences.hiddenDepartmentIds}
        departmentOrderOverrides={navPreferences.departmentOrderOverrides}
        productLineImageOverrides={navPreferences.productLineImageOverrides}
        moduleImageOverrides={navPreferences.moduleImageOverrides}
        appearance={navPreferences.appearance}
        weatherBranches={weatherBranches}
      />
    </div>
  )
}
