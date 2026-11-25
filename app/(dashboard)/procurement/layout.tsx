import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { canEnterModuleArea } from "@/shared/permissions/module-access-catalog"
import { APPEARANCE_COOKIE, resolveAppearance } from "@/shared/appearance"
import { ModuleBackdrop } from "@/components/shell/module-backdrop"
import { NavbarModuleTabs } from "@/components/shell/navbar-module-tabs"

export default async function ProcurementLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canEnterModuleArea(roles, "procurement", session.user.moduleAccess)) redirect("/")

  const t = await getTranslations("procurement")
  const isDark = resolveAppearance((await cookies()).get(APPEARANCE_COOKIE)?.value) === "dark"
  const tabs = [{ key: "orders", label: t("tabOrders"), href: "/procurement" }]

  return (
    <ModuleBackdrop isDark={isDark}>
      <NavbarModuleTabs items={tabs} aria-label={t("moduleTitle")} />
      <div className="relative z-10 min-w-0">{children}</div>
    </ModuleBackdrop>
  )
}
