"use client"

import { cn } from "@/lib/utils"
import { AlertCircle } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel,
  className,
}: ErrorStateProps) {
  const tUi = useTranslations("ui")
  const tCommon = useTranslations("common")
  const resolvedTitle = title ?? tUi("errorTitle")
  const resolvedRetry = retryLabel ?? tCommon("retry")

  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center justify-center px-4 py-16 text-center", className)}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/40">
        <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
      </div>
      <h3 className="mb-1 font-semibold text-foreground">{resolvedTitle}</h3>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {onRetry && (
        <div className="mt-4">
          <Button type="button" variant="outline" onClick={onRetry}>
            {resolvedRetry}
          </Button>
        </div>
      )}
    </div>
  )
}
