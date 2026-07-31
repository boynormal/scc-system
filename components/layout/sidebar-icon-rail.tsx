"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Grid3X3 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProductLineDef } from "@/shared/navigation/productLineRegistry"
import type { NavIconKey } from "@/shared/navigation/moduleRegistry"
import { pathMatchesHref } from "@/shared/navigation/groupNavByProductLine"
import { NAV_ICON_MAP } from "./nav-icon-map"
import { APP_BRAND } from "@/shared/branding"
import { CompanyBrandMark } from "@/components/brand/company-brand-mark"

type Props = {
  productLines: ProductLineDef[]
  activeProductLineId: string | null
  openProductLineId: string | null
  onProductLineClick: (productLineId: string) => void
  productLineIconOverrides?: Record<string, NavIconKey>
  productLineImageOverrides?: Record<string, string>
  logoUrl?: string | null
}

export function SidebarIconRail({
  productLines,
  activeProductLineId,
  openProductLineId,
  onProductLineClick,
  productLineIconOverrides = {},
  productLineImageOverrides = {},
  logoUrl,
}: Props) {
  const pathname = usePathname()
  const isAppsPage = pathMatchesHref(pathname, "/apps")

  return (
    <aside className="relative w-16 bg-card border-r border-border flex flex-col h-full shrink-0 min-h-0 z-30">
      <div className="py-4 flex flex-col items-center border-b border-border shrink-0">
        <Link
          href="/apps"
          className="transition-opacity hover:opacity-90"
          title={`${APP_BRAND.shortName} — Applications`}
        >
          <CompanyBrandMark logoUrl={logoUrl} size="sm" alt={APP_BRAND.name} />
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
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Grid3X3 className="w-5 h-5" />
        </Link>

        <div className="w-8 border-t border-border my-1" role="separator" />

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
                "w-11 h-11 flex items-center justify-center overflow-hidden rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                imageUrl
                  ? isOpen
                    ? "ring-2 ring-blue-600 shadow-sm"
                    : isActiveRoute
                      ? "ring-2 ring-blue-200"
                      : "hover:opacity-90"
                  : isOpen
                    ? "bg-blue-50 text-blue-700 ring-2 ring-blue-600 shadow-sm"
                    : isActiveRoute
                      ? "bg-blue-50 text-blue-700 ring-2 ring-blue-200"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                  unoptimized
                />
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
