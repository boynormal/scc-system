"use client"

import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { LOCALE_COOKIE, type AppLocale } from "@/i18n/config"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  /** Compact styling for dark auth screens */
  variant?: "default" | "onDark"
}

export function LocaleSwitcher({ className, variant = "default" }: Props) {
  const locale = useLocale() as AppLocale
  const t = useTranslations("locale")
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const next: AppLocale = locale === "th" ? "en" : "th"
  const label = next === "en" ? t("switchToEn") : t("switchToTh")
  const badge = next.toUpperCase()

  function toggle() {
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold tracking-wide transition disabled:opacity-50",
        variant === "onDark"
          ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
          : "border-glass bg-glass text-muted-foreground backdrop-blur-glass hover:bg-glass-strong hover:text-foreground",
        className
      )}
    >
      {badge}
    </button>
  )
}
