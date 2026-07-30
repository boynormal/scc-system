"use client"

import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { LOCALE_COOKIE, locales, type AppLocale } from "@/i18n/config"
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

  function onChange(next: AppLocale) {
    if (next === locale) return
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <label
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        variant === "onDark" ? "text-white/70" : "text-muted-foreground",
        className
      )}
    >
      <span className="sr-only">{t("label")}</span>
      <select
        aria-label={t("label")}
        value={locale}
        disabled={pending}
        onChange={(e) => onChange(e.target.value as AppLocale)}
        className={cn(
          "rounded-lg border px-2 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50",
          variant === "onDark"
            ? "border-white/20 bg-white/10 text-white"
            : "border-border bg-background text-foreground"
        )}
      >
        {locales.map((code) => (
          <option key={code} value={code} className="text-foreground">
            {t(code)}
          </option>
        ))}
      </select>
    </label>
  )
}
