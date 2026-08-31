"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Download, Network, Printer, Table } from "lucide-react"
import { cn } from "@/lib/utils"

export function OrgViewToolbar({
  view,
  printHref,
  exportHref,
  canExport,
}: {
  view: "chart" | "dept"
  printHref: string
  exportHref: string
  canExport: boolean
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function hrefFor(next: "chart" | "dept") {
    const params = new URLSearchParams(searchParams.toString())
    if (next === "chart") params.delete("view")
    else params.set("view", next)
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  const tabClass = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
      active
        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
        : "border-border text-muted-foreground hover:bg-muted"
    )

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-2">
        <Link href={hrefFor("chart")} className={tabClass(view === "chart")}>
          <Network className="h-4 w-4" />
          ผังองค์กร
        </Link>
        <Link href={hrefFor("dept")} className={tabClass(view === "dept")}>
          <Table className="h-4 w-4" />
          มุมมองแผนก
        </Link>
      </div>

      {canExport && (
        <div className="flex gap-2">
          <Link
            href={printHref}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            <Printer className="h-4 w-4" />
            พิมพ์
          </Link>
          <a
            href={exportHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            Excel
          </a>
        </div>
      )}
    </div>
  )
}
