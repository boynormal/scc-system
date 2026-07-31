"use client"

import { useEffect, useMemo, useRef } from "react"
import Link from "next/link"
import { ImageIcon, LayoutGrid, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import type { ModuleNavNode } from "@/shared/navigation/moduleRegistry"
import type { ProductLineDef } from "@/shared/navigation/productLineRegistry"
import { NAV_ICON_MAP } from "./nav-icon-map"
import { SidebarNavTree } from "./sidebar-nav-tree"

type Props = {
  open: boolean
  productLine: ProductLineDef | null
  navNodes: ModuleNavNode[]
  onClose: () => void
  triggerButtonId?: string
  moduleImageOverrides?: Record<string, string>
}

/** section เดียวใต้ product line → แสดง children โดยตรง ลดป้ายหัวข้อซ้ำกับ header */
function unwrapSingletonSection(nodes: ModuleNavNode[]): ModuleNavNode[] {
  if (nodes.length === 1 && nodes[0].type === "section") {
    return nodes[0].children
  }
  return nodes
}

export function SidebarOffCanvasPanel({
  open,
  productLine,
  navNodes,
  onClose,
  triggerButtonId,
  moduleImageOverrides = {},
}: Props) {
  const panelRef = useRef<HTMLElement>(null)
  const t = useTranslations("nav")
  const LineIcon = productLine ? NAV_ICON_MAP[productLine.iconKey] : null
  const treeNodes = useMemo(() => unwrapSingletonSection(navNodes), [navNodes])
  const showPlatformFooter = productLine?.id === "settings_admin"

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
          "fixed top-0 z-50 h-full w-60 bg-card border-r border-border shadow-lg flex flex-col outline-none transition-[transform,left] duration-200 ease-out",
          open ? "left-16 translate-x-0" : "left-0 -translate-x-full pointer-events-none invisible"
        )}
      >
        <div className="flex items-start justify-between gap-2 px-4 py-4 border-b border-border shrink-0">
          <div className="flex min-w-0 items-start gap-3">
            {LineIcon && productLine && (
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md",
                  productLine.accent
                )}
              >
                <LineIcon className="h-5 w-5" strokeWidth={1.9} />
              </span>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold leading-snug text-foreground">
                {productLine?.labelTh ?? ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-muted-foreground hover:text-muted-foreground hover:bg-muted rounded-lg shrink-0"
            aria-label="ปิดเมนู"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 px-3 py-4 overflow-y-auto overscroll-contain">
          {treeNodes.length > 0 ? (
            <SidebarNavTree
              nodes={treeNodes}
              onNavigate={handleClose}
              moduleImageOverrides={moduleImageOverrides}
            />
          ) : (
            <p className="px-3 text-sm text-muted-foreground">ไม่มีเมนูในกลุ่มนี้</p>
          )}
        </nav>

        {showPlatformFooter && (
          <div className="shrink-0 space-y-0.5 border-t border-border px-3 py-3">
            <Link
              href="/settings/company-logo"
              onClick={handleClose}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ImageIcon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate">{t("settings_company_logo")}</span>
            </Link>
            <Link
              href="/settings/home-screen"
              onClick={handleClose}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LayoutGrid className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate">{t("settings_home_screen")}</span>
            </Link>
          </div>
        )}
      </aside>
    </>
  )
}
