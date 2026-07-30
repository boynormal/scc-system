"use client"

import { useTranslations } from "next-intl"
import NotificationBell from "@/components/layout/notification-bell"
import NavCommandPalette from "@/components/layout/nav-command-palette"
import { LocaleSwitcher } from "@/components/layout/locale-switcher"
import { ThemeSwitcher } from "@/components/layout/theme-switcher"
import { UserMenu } from "@/components/layout/user-menu"
import { GlassNavbar } from "@/components/glass"
import type { AppAppearance } from "@/shared/appearance"
import type { ModuleNavNode } from "@/shared/navigation/moduleRegistry"

interface HeaderProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
  navItems: ModuleNavNode[]
  appearance: AppAppearance
}

export default function Header({ user, navItems, appearance }: HeaderProps) {
  const t = useTranslations("header")
  return (
    <GlassNavbar>
      <div className="flex items-center gap-2">
        <NavCommandPalette navItems={navItems} />
      </div>

      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label={t("preferencesGroup")}
        >
          <ThemeSwitcher appearance={appearance} className="h-8 w-8" />
          <LocaleSwitcher className="h-8 w-8" />
        </div>

        <div className="h-5 w-px bg-border" aria-hidden />

        <div
          className="flex items-center gap-1"
          role="group"
          aria-label={t("accountGroup")}
        >
          <NotificationBell />
          <UserMenu user={user} />
        </div>
      </div>
    </GlassNavbar>
  )
}
