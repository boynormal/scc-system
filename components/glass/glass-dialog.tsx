"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { GlassSurface } from "./glass-surface"

interface GlassDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: React.ReactNode
  className?: string
  /** Opaque panel (no glass blur / translucency). */
  solid?: boolean
}

export function GlassDialog({
  open,
  onOpenChange,
  title,
  children,
  className,
  solid = false,
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

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className={cn(
          "absolute inset-0",
          solid ? "bg-slate-900/50" : "bg-slate-900/20 backdrop-blur-md dark:bg-slate-950/35"
        )}
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
          solid
            ? "border-[#cbd5e1] bg-[#ffffff] shadow-[0_20px_60px_rgb(15_23_42/0.25)] backdrop-blur-none [--background:0_0%_100%] [--foreground:222.2_84%_4.9%] [--card:0_0%_100%] [--muted:210_40%_96.1%] [--muted-foreground:215.4_16.3%_46.9%] [--border:214.3_31.8%_91.4%]"
            : [
                "border-slate-300/70 bg-white/85 shadow-[0_20px_60px_rgb(15_23_42/0.18)]",
                "backdrop-blur-xl backdrop-saturate-150",
                "dark:border-white/15 dark:bg-slate-900/40 dark:shadow-[0_24px_70px_rgb(0_0_0/0.55),0_0_0_1px_rgb(255_255_255/0.08)]",
              ],
          "animate-in fade-in-0 zoom-in-95 duration-200",
          className
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {!solid && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-violet-400/30 blur-3xl dark:bg-violet-500/20"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -left-12 h-44 w-44 rounded-full bg-sky-300/25 blur-3xl dark:bg-sky-400/15"
            />
          </>
        )}
        <div className="relative max-h-[85vh] overflow-y-auto">
          <div
            className={cn(
              "sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4",
              solid
                ? "border-[#cbd5e1] bg-[#e2e8f0]"
                : "border-slate-200/80 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-white/5"
            )}
          >
            <h2 className={cn("text-base font-semibold", solid ? "text-[#0f172a]" : "text-foreground")}>{title}</h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={cn(
                "rounded-full p-1.5 transition",
                solid
                  ? "text-[#334155] hover:bg-[#cbd5e1] hover:text-[#0f172a]"
                  : "text-muted-foreground hover:bg-white/50 hover:text-foreground dark:hover:bg-white/10 dark:hover:text-slate-200"
              )}
              aria-label="ปิด"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
        </div>
      </GlassSurface>
    </div>,
    document.body
  )
}
