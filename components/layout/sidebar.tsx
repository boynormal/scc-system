"use client"

import { useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import type { ModuleNavNode, NavIconKey } from "@/shared/navigation/moduleRegistry"
import { PRODUCT_LINE_BY_ID } from "@/shared/navigation/productLineRegistry"
import {
  filterNavByProductLine,
  getVisibleProductLines,
  resolveActiveProductLineId,
} from "@/shared/navigation/groupNavByProductLine"
import { SidebarIconRail } from "./sidebar-icon-rail"
import { SidebarOffCanvasPanel } from "./sidebar-offcanvas-panel"

export default function Sidebar({
  navItems,
  productLineIconOverrides = {},
  productLineImageOverrides = {},
}: {
  navItems: ModuleNavNode[]
  productLineIconOverrides?: Record<string, NavIconKey>
  productLineImageOverrides?: Record<string, string>
}) {
  const pathname = usePathname()
  const [openProductLineId, setOpenProductLineId] = useState<string | null>(null)

  const visibleProductLines = useMemo(() => getVisibleProductLines(navItems), [navItems])
  const activeProductLineId = useMemo(
    () => resolveActiveProductLineId(pathname, navItems),
    [pathname, navItems]
  )

  const openProductLine = openProductLineId ? PRODUCT_LINE_BY_ID[openProductLineId] ?? null : null
  const panelNavNodes = useMemo(
    () => (openProductLineId ? filterNavByProductLine(navItems, openProductLineId) : []),
    [navItems, openProductLineId]
  )

  const handleProductLineClick = (productLineId: string) => {
    setOpenProductLineId((prev) => (prev === productLineId ? null : productLineId))
  }

  const handleClosePanel = () => setOpenProductLineId(null)

  return (
    <div className="relative shrink-0 h-full">
      <SidebarIconRail
        productLines={visibleProductLines}
        activeProductLineId={activeProductLineId}
        openProductLineId={openProductLineId}
        onProductLineClick={handleProductLineClick}
        productLineIconOverrides={productLineIconOverrides}
        productLineImageOverrides={productLineImageOverrides}
      />
      <SidebarOffCanvasPanel
        open={openProductLineId !== null}
        productLine={openProductLine}
        navNodes={panelNavNodes}
        onClose={handleClosePanel}
        triggerButtonId={openProductLineId ? `sidebar-pl-${openProductLineId}` : undefined}
      />
    </div>
  )
}
