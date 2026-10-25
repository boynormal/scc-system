"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronDown, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type IncomePrintSize = "a4" | "80mm"

export function incomePrintHref(id: string, size: IncomePrintSize, auto = true): string {
  return `/finance/incomes/${id}/print?size=${size}${auto ? "&auto=1" : ""}`
}

export function IncomePrintButtons({ id, size, className }: { id: string; size?: "sm"; className?: string }) {
  const t = useTranslations("financeIncome")
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const icon = <Printer className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [open])

  function print(paper: IncomePrintSize) {
    setOpen(false)
    window.open(incomePrintHref(id, paper), "_blank", "noopener")
  }

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0">
      <Button
        type="button"
        variant="outline"
        size={size}
        className={cn(size === "sm" && "h-7", "whitespace-nowrap", className)}
        icon={icon}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {t("print")}
        <ChevronDown className={cn("ml-1 inline-block shrink-0", size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />
      </Button>
      {open && (
        <div
          role="menu"
          aria-label={t("print")}
          className="absolute right-0 top-full z-30 mt-1 min-w-[9rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-slate-900"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-50 dark:text-white dark:hover:bg-white/5"
            onClick={() => print("a4")}
          >
            {t("printA4")}
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-50 dark:text-white dark:hover:bg-white/5"
            onClick={() => print("80mm")}
          >
            {t("print80")}
          </button>
        </div>
      )}
    </div>
  )
}
