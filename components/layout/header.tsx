"use client"

import { useTranslations } from "next-intl"
import NotificationBell from "@/components/layout/notification-bell"
import { LocaleSwitcher } from "@/components/layout/locale-switcher"
import { ThemeSwitcher } from "@/components/layout/theme-switcher"
import { UserMenu } from "@/components/layout/user-menu"
import { GlassNavbar } from "@/components/glass"
import { ModuleTabSlotTarget } from "@/components/shell/module-tab-slot"
import type { AppAppearance } from "@/shared/appearance"

interface HeaderProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
  appearance: AppAppearance
}

export default function Header({ user, appearance }: HeaderProps) {
  const t = useTranslations("header")
  return (
    <GlassNavbar className="gap-3">
      <ModuleTabSlotTarget className="flex min-w-0 flex-1 items-center overflow-hidden" />
      <div className="flex shrink-0 items-center gap-3">
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label={t("preferencesGroup")}
        >
          <ThemeSwitcher appearance={appearance} className="h-8 w-8" />
          <LocaleSwitcher className="h-8 w-8" />
          <NotificationBell />
        </div>

        <div className="h-5 w-px bg-border" aria-hidden />

        <div
          className="flex items-center gap-1"
          role="group"
          aria-label={t("accountGroup")}
        >
          <UserMenu user={user} />
        </div>
      </div>
    </GlassNavbar>
  )
}
