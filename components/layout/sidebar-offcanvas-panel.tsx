"use client"

import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ModuleNavNode } from "@/shared/navigation/moduleRegistry"
import type { ProductLineDef } from "@/shared/navigation/productLineRegistry"
import { SidebarNavTree } from "./sidebar-nav-tree"

type Props = {
  open: boolean
  productLine: ProductLineDef | null
  navNodes: ModuleNavNode[]
  onClose: () => void
  triggerButtonId?: string
}

export function SidebarOffCanvasPanel({ open, productLine, navNodes, onClose, triggerButtonId }: Props) {
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
  }, [open, productLine?.id])

  const handleClose = () => {
    onClose()
    if (triggerButtonId) {
      document.getElementById(triggerButtonId)?.focus()
    }
  }

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="ปิดเมนู"
          className="fixed inset-0 z-40 bg-black/20 md:bg-black/10"
          onClick={handleClose}
        />
      )}

      <aside
        ref={panelRef}
        tabIndex={-1}
        aria-hidden={!open}
        aria-label={productLine ? `เมนู ${productLine.labelTh}` : undefined}
        className={cn(
          "fixed top-0 z-50 h-full w-60 bg-white border-r border-slate-200 shadow-lg flex flex-col outline-none transition-[transform,left] duration-200 ease-out",
          open ? "left-16 translate-x-0" : "left-0 -translate-x-full pointer-events-none invisible"
        )}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-4 border-b border-slate-200 shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{productLine?.labelTh ?? ""}</p>
            {productLine?.description && (
              <p className="text-[11px] text-slate-400 truncate mt-0.5">{productLine.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg shrink-0"
            aria-label="ปิดเมนู"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 px-3 py-4 overflow-y-auto overscroll-contain">
          {navNodes.length > 0 ? (
            <SidebarNavTree nodes={navNodes} onNavigate={handleClose} />
          ) : (
            <p className="px-3 text-sm text-slate-400">ไม่มีเมนูในกลุ่มนี้</p>
          )}
        </nav>
      </aside>
    </>
  )
}
