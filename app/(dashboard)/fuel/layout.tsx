import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { canEnterModuleArea } from "@/shared/permissions/module-access-catalog"
import { APPEARANCE_COOKIE, resolveAppearance } from "@/shared/appearance"
import { ModuleBackdrop } from "@/components/shell/module-backdrop"
import { ModuleTabs } from "@/components/shell/module-tabs"
import { canFuelAnywhere } from "@/modules/fuel"

export default async function FuelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canEnterModuleArea(roles, "fuel", session.user.moduleAccess)) redirect("/")

  const t = await getTranslations("fuel")
  const isDark = resolveAppearance((await cookies()).get(APPEARANCE_COOKIE)?.value) === "dark"
  const canCreate = canFuelAnywhere(roles, "create")
  const tabs = [
    { key: "overview", label: t("tabOverview"), href: "/fuel", exact: true },
    ...(canCreate
      ? [
          { key: "dispense", label: t("tabDispense"), href: "/fuel/dispense" },
          { key: "receive", label: t("tabReceive"), href: "/fuel/receive" },
        ]
      : []),
    { key: "transactions", label: t("tabTransactions"), href: "/fuel/transactions" },
    { key: "tanks", label: t("tabTanks"), href: "/fuel/tanks" },
    { key: "reports", label: t("tabReports"), href: "/fuel/reports" },
    { key: "types", label: t("tabTypes"), href: "/fuel/master-data" },
  ]

  return (
    <ModuleBackdrop isDark={isDark}>
      <div className="relative z-10 min-w-0 space-y-4">
        <ModuleTabs items={tabs} aria-label={t("moduleTitle")} />
        {children}
      </div>
    </ModuleBackdrop>
  )
}
