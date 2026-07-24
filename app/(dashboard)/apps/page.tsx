import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { IpadLauncher } from "@/components/apps/ipad-launcher"
import { buildDashboardNav, flattenNavForLauncher } from "@/shared/navigation"
import { parseCompanyNavPreferences } from "@/shared/navigation/companyNavPreferences"
import { redirect } from "next/navigation"

/** หน้าหลัก — launcher แบบ iPad */
export default async function AppsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { settings: true },
  })

  const navPreferences = parseCompanyNavPreferences(company?.settings ?? null)
  const navItems = buildDashboardNav(session.user.roles, navPreferences, session.user.moduleAccess)
  const apps = flattenNavForLauncher(navItems)

  return (
    <div className="-m-6 h-[calc(100vh-3.5rem)] overflow-hidden">
      <IpadLauncher
        apps={apps}
        pinnedModuleIds={navPreferences.pinnedModuleIds}
        hiddenDepartmentIds={navPreferences.hiddenDepartmentIds}
        departmentOrderOverrides={navPreferences.departmentOrderOverrides}
        productLineImageOverrides={navPreferences.productLineImageOverrides}
        appearance={navPreferences.appearance}
      />
    </div>
  )
}
