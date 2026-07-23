"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useMemo, useState } from "react"
import type { ModuleNavNode } from "@/shared/navigation/moduleRegistry"
import { resolveActiveNavHref, subtreeContainsActiveHref } from "@/shared/navigation/groupNavByProductLine"
import { NAV_ICON_MAP } from "./nav-icon-map"

function NavGroup({
  node,
  depth,
  activeHref,
  onNavigate,
}: {
  node: Extract<ModuleNavNode, { type: "group" }>
  depth: number
  activeHref: string | null
  onNavigate?: () => void
}) {
  const [open, setOpen] = useState(false)
  const Icon = NAV_ICON_MAP[node.icon]
  const isActive = subtreeContainsActiveHref(node, activeHref)

  return (
    <div className={cn(depth > 0 && "ml-1 border-l border-slate-100 pl-2")}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open || isActive}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
          isActive
            ? "bg-blue-50 text-blue-700"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        )}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left">{node.label}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 shrink-0 transition-transform", (open || isActive) && "rotate-180")} />
      </button>
      {(open || isActive) && (
        <div className="ml-2 mt-0.5 space-y-0.5 border-l border-slate-100 pl-2">
          <SidebarNavTree nodes={node.children} depth={depth + 1} activeHref={activeHref} onNavigate={onNavigate} />
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
}

export function SidebarNavTree({ nodes, depth = 0, activeHref: activeHrefProp, onNavigate }: SidebarNavTreeProps) {
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
                className="px-3 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                role="presentation"
              >
                {node.label}
              </p>
              <div className="space-y-0.5">
                <SidebarNavTree nodes={node.children} depth={depth + 1} activeHref={activeHref} onNavigate={onNavigate} />
              </div>
            </div>
          )
        }

        if (node.type === "group") {
          return <NavGroup key={node.key} node={node} depth={depth} activeHref={activeHref} onNavigate={onNavigate} />
        }

        const Icon = NAV_ICON_MAP[node.icon]
        const isActive = node.href === activeHref
        return (
          <Link
            key={node.key}
            href={node.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
              depth > 0 && "ml-1 pl-2 border-l border-transparent hover:border-slate-100",
              isActive
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {node.label}
          </Link>
        )
      })}
    </>
  )
}
