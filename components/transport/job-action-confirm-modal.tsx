"use client"

import { useEffect, useId, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"

export type JobActionConfirmTone = "success" | "danger" | "warning"

type Props = {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: JobActionConfirmTone
  icon: ReactNode
  loading?: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}

const TONE: Record<
  JobActionConfirmTone,
  { iconWrap: string; confirmBtn: string }
> = {
  success: {
    iconWrap: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    confirmBtn: "bg-emerald-600 text-white hover:bg-emerald-700",
  },
  danger: {
    iconWrap: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
    confirmBtn: "bg-red-600 text-white hover:bg-red-700",
  },
  warning: {
    iconWrap: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
    confirmBtn: "bg-amber-600 text-white hover:bg-amber-700",
  },
}

export function JobActionConfirmModal({
  open,
  title,
  description,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ปิด",
  tone = "success",
  icon,
  loading = false,
  error = null,
  onConfirm,
  onCancel,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const titleId = useId()
  const descId = useId()
  const toneCls = TONE[tone]

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel()
    }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, loading, onCancel])

  if (!mounted || !open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-[22rem] animate-in fade-in zoom-in-95 rounded-2xl border border-border bg-card p-5 shadow-2xl duration-150"
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              toneCls.iconWrap
            )}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-start justify-between gap-2">
              <h2 id={titleId} className="text-sm font-semibold text-foreground">
                {title}
              </h2>
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label="ปิด"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p id={descId} className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted/60 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold disabled:opacity-50",
              toneCls.confirmBtn
            )}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {loading ? "กำลังบันทึก..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
