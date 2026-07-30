"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { useTranslations } from "next-intl"
import { Moon, Sun } from "lucide-react"
import {
  setAppearanceCookie,
  type AppAppearance,
} from "@/shared/appearance"
import { cn } from "@/lib/utils"

type Props = {
  appearance: AppAppearance
  className?: string
}

export function ThemeSwitcher({ appearance, className }: Props) {
  const t = useTranslations("header")
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const isDark = appearance === "dark"
  const next: AppAppearance = isDark ? "light" : "dark"
  const label = isDark ? t("themeToLight") : t("themeToDark")

  function toggle() {
    setAppearanceCookie(next)
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
        "inline-flex items-center justify-center rounded-lg border border-glass bg-glass p-2 text-muted-foreground backdrop-blur-glass transition hover:bg-glass-strong hover:text-foreground disabled:opacity-50",
        className
      )}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
