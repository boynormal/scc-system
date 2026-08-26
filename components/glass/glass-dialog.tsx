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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-md dark:bg-slate-950/35"
        role="presentation"
        onClick={() => onOpenChange(false)}
      />
      <GlassSurface
        intensity="soft"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 max-h-[85vh] w-full max-w-lg overflow-hidden rounded-[1.5rem] p-0",
          "border-slate-300/70 bg-white/85 shadow-[0_20px_60px_rgb(15_23_42/0.18)]",
          "backdrop-blur-xl backdrop-saturate-150",
          "animate-in fade-in-0 zoom-in-95 duration-200",
          "dark:border-white/15 dark:bg-slate-900/40 dark:shadow-[0_24px_70px_rgb(0_0_0/0.55),0_0_0_1px_rgb(255_255_255/0.08)]",
          className
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-violet-400/30 blur-3xl dark:bg-violet-500/20"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-12 h-44 w-44 rounded-full bg-sky-300/25 blur-3xl dark:bg-sky-400/15"
        />
        <div className="relative max-h-[85vh] overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/80 bg-white/70 px-5 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full p-1.5 text-muted-foreground transition hover:bg-white/50 hover:text-foreground dark:hover:bg-white/10 dark:hover:text-slate-200"
              aria-label="ปิด"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
        </div>
      </GlassSurface>
    </div>
  )
}
