import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { canEnterModuleArea } from "@/shared/permissions/module-access-catalog"
import { APPEARANCE_COOKIE, resolveAppearance } from "@/shared/appearance"
import { ModuleBackdrop } from "@/components/shell/module-backdrop"
import { NavbarModuleTabs } from "@/components/shell/navbar-module-tabs"
import { canDocumentMasters, canDocuments } from "@/modules/document_center"

export default async function DocumentCenterLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canEnterModuleArea(roles, "document_center", session.user.moduleAccess)) redirect("/")

  const t = await getTranslations("documentCenter")
  const isDark = resolveAppearance((await cookies()).get(APPEARANCE_COOKIE)?.value) === "dark"
  const tabs = [
    { key: "library", label: t("tabLibrary"), href: "/document-center", exact: true },
    { key: "mine", label: t("tabMine"), href: "/document-center/mine" },
    { key: "favorites", label: t("tabFavorites"), href: "/document-center/favorites" },
    { key: "recent", label: t("tabRecent"), href: "/document-center/recent" },
    ...(canDocuments(roles, "approve") ? [{ key: "audit", label: t("tabAudit"), href: "/document-center/audit" }] : []),
    ...(canDocumentMasters(roles, "read")
      ? [{ key: "settings", label: t("tabSettings"), href: "/document-center/master-data" }]
      : []),
  ]

  return (
    <ModuleBackdrop isDark={isDark}>
      <NavbarModuleTabs items={tabs} aria-label={t("moduleTitle")} />
      <div className="relative z-10 min-w-0">{children}</div>
    </ModuleBackdrop>
  )
}
