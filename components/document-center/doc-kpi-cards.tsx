import Link from "next/link"
import { docHref } from "./doc-href"
import type { DocSummary } from "@/modules/document_center"

export function DocKpiCards({
  pathname,
  query,
  summary,
  labels,
}: {
  pathname: string
  query: Record<string, string | undefined>
  summary: DocSummary
  labels: { total: string; active: string; favorites: string }
}) {
  const cards = [
    { key: "total", label: labels.total, value: summary.total, href: docHref(pathname, query, { kpi: null, page: null, selected: null }) },
    { key: "active", label: labels.active, value: summary.active, href: docHref(pathname, query, { kpi: "active", page: null, selected: null }) },
    { key: "favorites", label: labels.favorites, value: summary.favorites, href: docHref(pathname, query, { kpi: "favorite", page: null, selected: null }) },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <Link key={card.key} href={card.href} className="rounded-xl border border-border bg-white/80 px-4 py-3 text-foreground dark:bg-slate-900/50">
          <div className="text-sm">{card.label}</div>
          <div className="text-2xl font-semibold tabular-nums">{card.value.toLocaleString()}</div>
        </Link>
      ))}
    </div>
  )
}
