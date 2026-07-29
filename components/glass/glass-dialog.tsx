"use client"

import { useEffect } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { GlassSurface } from "./glass-surface"

interface GlassDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function GlassDialog({
  open,
  onOpenChange,
  title,
  children,
  className,
}: GlassDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false)
    }
    document.addEventListener("keydown", onKeyDown)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = prev
    }
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={() => onOpenChange(false)}
    >
      <GlassSurface
        intensity="strong"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-glass p-0 shadow-2xl",
          className
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-glass bg-glass-strong px-5 py-4 backdrop-blur-glass">
          <h2 className="text-base font-semibold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-white/40 hover:text-foreground dark:hover:bg-white/10 dark:hover:text-slate-200"
            aria-label="ปิด"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </GlassSurface>
    </div>
  )
}
