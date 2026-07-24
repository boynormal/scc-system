import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AppsLauncher } from "@/components/apps/apps-launcher"
import { buildDashboardNav, flattenNavForLauncher } from "@/shared/navigation"
import { parseCompanyNavPreferences } from "@/shared/navigation/companyNavPreferences"
import { cn } from "@/lib/utils"
import { redirect } from "next/navigation"

/** มุมมองการ์ด (เดิมอยู่ที่ /apps) */
export default async function App2Page() {
  const session = await auth()
  if (!session) redirect("/login")

  const company = await prisma.company.findUnique({
    where: { id: session.user.companyId },
    select: { settings: true },
  })

  const navPreferences = parseCompanyNavPreferences(company?.settings ?? null)
  const navItems = buildDashboardNav(session.user.roles, navPreferences)
  const apps = flattenNavForLauncher(navItems)
  const isDark = navPreferences.appearance === "dark"

  return (
    <div
      className={cn(
        "-m-6 min-h-full overflow-hidden bg-[radial-gradient(circle_at_15%_10%,rgba(45,212,191,0.18),transparent_28%),radial-gradient(circle_at_90%_8%,rgba(251,146,60,0.18),transparent_26%),linear-gradient(135deg,#f3f1fa_0%,#f8fafc_52%,#eef7f4_100%)] p-4 sm:p-6",
        "dark:bg-[linear-gradient(135deg,#0f172a_0%,#0b1220_100%)]",
        isDark && "dark"
      )}
    >
      <AppsLauncher
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
