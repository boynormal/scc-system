"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Grid3X3, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProductLineDef } from "@/shared/navigation/productLineRegistry"
import type { NavIconKey } from "@/shared/navigation/moduleRegistry"
import { pathMatchesHref } from "@/shared/navigation/groupNavByProductLine"
import { NAV_ICON_MAP } from "./nav-icon-map"
import { APP_BRAND } from "@/shared/branding"

type Props = {
  productLines: ProductLineDef[]
  activeProductLineId: string | null
  openProductLineId: string | null
  onProductLineClick: (productLineId: string) => void
  productLineIconOverrides?: Record<string, NavIconKey>
  productLineImageOverrides?: Record<string, string>
}

export function SidebarIconRail({
  productLines,
  activeProductLineId,
  openProductLineId,
  onProductLineClick,
  productLineIconOverrides = {},
  productLineImageOverrides = {},
}: Props) {
  const pathname = usePathname()
  const isAppsPage = pathMatchesHref(pathname, "/apps")

  return (
    <aside className="relative w-16 bg-white border-r border-slate-200 flex flex-col h-full shrink-0 min-h-0 z-30">
      <div className="py-4 flex flex-col items-center border-b border-slate-200 shrink-0">
        <Link
          href="/apps"
          className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-700 transition-colors"
          title={`${APP_BRAND.shortName} — Applications`}
        >
          <Wrench className="w-5 h-5 text-white" />
        </Link>
      </div>

      <nav className="flex-1 min-h-0 py-3 flex flex-col items-center gap-1 overflow-y-auto overscroll-contain" aria-label="เมนูหลัก">
        <Link
          href="/apps"
          title="Applications"
          className={cn(
            "w-11 h-11 flex items-center justify-center rounded-lg transition-colors",
            isAppsPage
              ? "bg-blue-50 text-blue-700 ring-2 ring-blue-200"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          )}
        >
          <Grid3X3 className="w-5 h-5" />
        </Link>

        <div className="w-8 border-t border-slate-200 my-1" role="separator" />

        {productLines.map((line) => {
          const iconKey = productLineIconOverrides[line.id] ?? line.iconKey
          const Icon = NAV_ICON_MAP[iconKey] ?? NAV_ICON_MAP[line.iconKey]
          const imageUrl = productLineImageOverrides[line.id]
          const isActiveRoute = activeProductLineId === line.id
          const isOpen = openProductLineId === line.id
          return (
            <button
              key={line.id}
              id={`sidebar-pl-${line.id}`}
              type="button"
              title={line.labelTh}
              aria-label={line.labelTh}
              aria-expanded={isOpen}
              onClick={() => onProductLineClick(line.id)}
              className={cn(
                "w-11 h-11 flex items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                isOpen
                  ? "bg-blue-50 text-blue-700 ring-2 ring-blue-600 shadow-sm"
                  : isActiveRoute
                    ? "bg-blue-50 text-blue-700 ring-2 ring-blue-200"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              )}
            >
              {imageUrl ? (
                <img src={imageUrl} alt="" className="h-7 w-7 rounded-md object-cover" />
              ) : (
                <Icon className="w-5 h-5" />
              )}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
