"use client"

import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

interface LoadingStateProps {
  title?: string
  description?: string
  className?: string
}

export function LoadingState({ title, description, className }: LoadingStateProps) {
  const t = useTranslations("ui")
  const resolvedTitle = title ?? t("loadingTitle")

  return (
    <div
      className={cn("flex flex-col items-center justify-center px-4 py-16 text-center", className)}
      aria-busy="true"
      aria-live="polite"
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
      <h3 className="mb-1 font-semibold text-foreground">{resolvedTitle}</h3>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}
