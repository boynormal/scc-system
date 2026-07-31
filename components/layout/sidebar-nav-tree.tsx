"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { ChevronDown, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useMemo, useState } from "react"
import type { ModuleNavNode, NavIconKey } from "@/shared/navigation/moduleRegistry"
import { resolveActiveNavHref, subtreeContainsActiveHref } from "@/shared/navigation/groupNavByProductLine"
import { isExternalHref } from "@/shared/navigation/isExternalHref"
import { NAV_ICON_MAP } from "./nav-icon-map"

function ModuleIcon({
  iconKey,
  imageUrl,
  className,
}: {
  iconKey: NavIconKey
  imageUrl?: string
  className?: string
}) {
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt=""
        width={16}
        height={16}
        className={cn("h-4 w-4 shrink-0 rounded object-cover", className)}
        unoptimized
      />
    )
  }
  const Icon: LucideIcon = NAV_ICON_MAP[iconKey]
  return <Icon className={cn("h-4 w-4 shrink-0", className)} />
}

function NavGroup({
  node,
  depth,
  activeHref,
  onNavigate,
  moduleImageOverrides,
}: {
  node: Extract<ModuleNavNode, { type: "group" }>
  depth: number
  activeHref: string | null
  onNavigate?: () => void
  moduleImageOverrides: Record<string, string>
}) {
  const isActive = subtreeContainsActiveHref(node, activeHref)
  // เปิดค้างเป็นค่าเริ่มต้น — และเปิดอัตโนมัติเมื่อ path อยู่ในกลุ่มนี้
  const [open, setOpen] = useState(true)
  const imageUrl = moduleImageOverrides[node.moduleId]
  const expanded = open || isActive

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
          isActive
            ? "bg-blue-50 text-blue-700"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <ModuleIcon iconKey={node.icon} imageUrl={imageUrl} />
        <span className="min-w-0 flex-1 truncate text-left leading-none">{node.label}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 transition-transform", expanded && "rotate-180")}
        />
      </button>
      {expanded && (
        <div className="space-y-0.5 pl-3">
          <SidebarNavTree
            nodes={node.children}
            depth={depth + 1}
            activeHref={activeHref}
            onNavigate={onNavigate}
            moduleImageOverrides={moduleImageOverrides}
          />
        </div>
      )}
    </div>
  )
}

type SidebarNavTreeProps = {
  nodes: ModuleNavNode[]
  depth?: number
  activeHref?: string | null
  onNavigate?: () => void
  moduleImageOverrides?: Record<string, string>
}

export function SidebarNavTree({
  nodes,
  depth = 0,
  activeHref: activeHrefProp,
  onNavigate,
  moduleImageOverrides = {},
}: SidebarNavTreeProps) {
  const pathname = usePathname()
  const activeHref = useMemo(
    () => activeHrefProp ?? resolveActiveNavHref(pathname, nodes),
    [activeHrefProp, pathname, nodes]
  )

  return (
    <>
      {nodes.map((node) => {
        if (node.type === "section") {
          return (
            <div key={node.key} className={cn(depth > 0 && "mt-1")}>
              <p
                className="px-3 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                role="presentation"
              >
                {node.label}
              </p>
              <div className="space-y-0.5">
                <SidebarNavTree
                  nodes={node.children}
                  depth={depth + 1}
                  activeHref={activeHref}
                  onNavigate={onNavigate}
                  moduleImageOverrides={moduleImageOverrides}
                />
              </div>
            </div>
          )
        }

        if (node.type === "group") {
          return (
            <NavGroup
              key={node.key}
              node={node}
              depth={depth}
              activeHref={activeHref}
              onNavigate={onNavigate}
              moduleImageOverrides={moduleImageOverrides}
            />
          )
        }

        const imageUrl = moduleImageOverrides[node.moduleId]
        const isActive = node.href === activeHref
        const linkClassName = cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
          isActive
            ? "bg-blue-600 text-white shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )

        if (isExternalHref(node.href)) {
          return (
            <a
              key={node.key}
              href={node.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onNavigate}
              className={linkClassName}
            >
              <ModuleIcon iconKey={node.icon} imageUrl={imageUrl} />
              <span className="min-w-0 truncate">{node.label}</span>
            </a>
          )
        }

        return (
          <Link key={node.key} href={node.href} onClick={onNavigate} className={linkClassName}>
            <ModuleIcon iconKey={node.icon} imageUrl={imageUrl} />
            <span className="min-w-0 truncate">{node.label}</span>
          </Link>
        )
      })}
    </>
  )
}
