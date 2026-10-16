"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Search } from "lucide-react"

type Option = { id: string; name: string }

export function PmCalendarFilters({
  branches,
  types,
  year,
  month,
}: {
  branches: Option[]
  types: Option[]
  year: number
  month: number
}) {
  const t = useTranslations("pmCheck")
  const assets = useTranslations("assets")
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(searchParams.get("search") || "")
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("tab", "pm-calendar")
      params.set("year", String(year))
      params.set("month", String(month))
      if (value) params.set(key, value)
      else params.delete(key)
      startTransition(() => {
        router.push(`/assets?${params.toString()}`)
      })
    },
    [searchParams, router, year, month]
  )

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      if (search !== (searchParams.get("search") || "")) {
        handleFilter("search", search)
      }
    }, 500)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [search, searchParams, handleFilter])

  const hasFilters = searchParams.get("search") || searchParams.get("branchId") || searchParams.get("type")

  return (
    <div className="rounded-xl border border-[#cbd5e1] bg-[#ffffff] p-3 shadow-sm">
      <div className={`flex flex-wrap items-center gap-3 ${isPending ? "pointer-events-none opacity-70" : ""}`}>
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("calendarSearch")}
            className="w-full rounded-lg border border-[#94a3b8] bg-[#ffffff] py-2 pl-9 pr-3 text-sm text-[#0f172a] placeholder:text-[#64748b] focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          aria-label={assets("branch")}
          defaultValue={searchParams.get("branchId") || ""}
          onChange={(event) => handleFilter("branchId", event.target.value)}
          className="rounded-lg border border-[#94a3b8] bg-[#ffffff] px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t("filterAllBranches")}</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
        <select
          aria-label={assets("type")}
          defaultValue={searchParams.get("type") || ""}
          onChange={(event) => handleFilter("type", event.target.value)}
          className="rounded-lg border border-[#94a3b8] bg-[#ffffff] px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t("filterAllTypes")}</option>
          {types.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
        {hasFilters && (
          <Link
            href={`/assets?tab=pm-calendar&year=${year}&month=${month}`}
            onClick={() => setSearch("")}
            className="rounded-lg border border-[#334155] bg-[#1e293b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f172a]"
          >
            {assets("clearFilters")}
          </Link>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-4 text-sm text-[#0f172a]">
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded bg-[#059669]" />
            {t("pass")}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded bg-[#facc15]" />
            {t("fail")}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded bg-[#cbd5e1]" />
            {t("calendarNone")}
          </span>
        </div>
      </div>
    </div>
  )
}
