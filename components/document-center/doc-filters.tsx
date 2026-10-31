"use client"

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Search } from "lucide-react"

type Option = { id: string; name: string }
type Period = "" | "7" | "30" | "month" | "year" | "custom"

const control =
  "h-9 shrink-0 rounded-lg border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"

function ymd(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function periodRange(period: Exclude<Period, "" | "custom">, today = new Date()): { from: string; to: string } {
  const to = ymd(today)
  if (period === "7" || period === "30") {
    const from = new Date(today)
    from.setDate(from.getDate() - (period === "7" ? 6 : 29))
    return { from: ymd(from), to }
  }
  if (period === "month") return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to }
  return { from: ymd(new Date(today.getFullYear(), 0, 1)), to }
}

function selectedPeriod(from: string, to: string): Period {
  if (!from && !to) return ""
  for (const period of ["7", "30", "month", "year"] as const) {
    const range = periodRange(period)
    if (range.from === from && range.to === to) return period
  }
  return "custom"
}

export function DocFilters({
  categories,
  canSeeDeleted,
  children,
}: {
  categories: Option[]
  canSeeDeleted: boolean
  children?: ReactNode
}) {
  const t = useTranslations("documentCenter")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState(searchParams.get("q") || "")
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const applyMany = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(patch)) {
        if (value) params.set(key, value)
        else params.delete(key)
      }
      params.delete("page")
      params.delete("selected")
      params.delete("dept")
      params.delete("file")
      params.delete("type")
      params.delete("branch")
      startTransition(() => router.push(params.toString() ? `${pathname}?${params}` : pathname))
    },
    [pathname, router, searchParams]
  )

  const apply = useCallback((key: string, value: string) => applyMany({ [key]: value }), [applyMany])

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      if (search !== (searchParams.get("q") || "")) apply("q", search)
    }, 400)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [apply, search, searchParams])

  const from = searchParams.get("from") || ""
  const to = searchParams.get("to") || ""
  const period = selectedPeriod(from, to)
  const active = ["q", "category", "status", "from", "to", "kpi"].some((key) => searchParams.get(key))

  return (
    <div className="flex w-full min-w-0 flex-1 items-end gap-2">
      <div className={`flex min-w-0 flex-1 items-end gap-2 overflow-x-auto ${pending ? "pointer-events-none opacity-70" : ""}`}>
        <div className="relative w-44 shrink-0 sm:w-52">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className={`${control} w-full pl-8`}
          />
        </div>
        <select className={`${control} lg:hidden`} value={searchParams.get("category") || ""} onChange={(event) => apply("category", event.target.value)} aria-label={t("category")}>
          <option value="">{t("allCategories")}</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
        <select className={control} value={searchParams.get("status") || ""} onChange={(event) => apply("status", event.target.value)} aria-label={t("allStatuses")}>
          <option value="">{t("allStatuses")}</option>
          <option value="ACTIVE">{t("statusActive")}</option>
          <option value="INACTIVE">{t("statusInactive")}</option>
          {canSeeDeleted ? <option value="DELETED">{t("statusDeleted")}</option> : null}
        </select>
        <select
          className={control}
          aria-label={t("periodAll")}
          value={period}
          onChange={(event) => {
            const next = event.target.value as Period
            if (!next || next === "custom") {
              applyMany({ from: "", to: "" })
              return
            }
            applyMany(periodRange(next))
          }}
        >
          <option value="">{t("periodAll")}</option>
          <option value="7">{t("period7")}</option>
          <option value="30">{t("period30")}</option>
          <option value="month">{t("periodMonth")}</option>
          <option value="year">{t("periodYear")}</option>
          {period === "custom" ? <option value="custom">{t("periodCustom")}</option> : null}
        </select>
        {active ? (
          <Link href={pathname} className="shrink-0 self-center text-sm text-foreground underline">
            {t("clearFilters")}
          </Link>
        ) : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  )
}
