"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Search } from "lucide-react"

type BranchOption = { id: string; name: string }

export function AssetFilters({ branches }: { branches: BranchOption[] }) {
  const t = useTranslations("assets")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(searchParams.get("search") || "")
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      params.delete("page")
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [searchParams, pathname, router]
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

  const hasFilters =
    searchParams.get("search") ||
    searchParams.get("type") ||
    searchParams.get("status") ||
    searchParams.get("ownership") ||
    searchParams.get("branchId")

  return (
    <div className={`flex flex-wrap gap-3 ${isPending ? "pointer-events-none opacity-70" : ""}`}>
      <div className="relative min-w-48 flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full rounded-lg border border-border py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <select
        defaultValue={searchParams.get("branchId") || ""}
        onChange={(e) => handleFilter("branchId", e.target.value)}
        className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">{t("filterAll")}</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <select
        defaultValue={searchParams.get("type") || ""}
        onChange={(e) => handleFilter("type", e.target.value)}
        className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">{t("filterAll")}</option>
        <option value="VEHICLE">{t("type_VEHICLE")}</option>
        <option value="MACHINE">{t("type_MACHINE")}</option>
      </select>
      <select
        defaultValue={searchParams.get("ownership") || ""}
        onChange={(e) => handleFilter("ownership", e.target.value)}
        className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">{t("filterAll")}</option>
        <option value="COMPANY">{t("own_COMPANY")}</option>
        <option value="LEASED">{t("own_LEASED")}</option>
        <option value="EXTERNAL">{t("own_EXTERNAL")}</option>
      </select>
      <select
        defaultValue={searchParams.get("status") || ""}
        onChange={(e) => handleFilter("status", e.target.value)}
        className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">{t("filterAll")}</option>
        <option value="REGISTERED">{t("st_REGISTERED")}</option>
        <option value="ACTIVE">{t("st_ACTIVE")}</option>
        <option value="IDLE">{t("st_IDLE")}</option>
        <option value="RETIRED">{t("st_RETIRED")}</option>
        <option value="DISPOSED">{t("st_DISPOSED")}</option>
      </select>
      {hasFilters && (
        <Link
          href="/assets"
          onClick={() => setSearch("")}
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60"
        >
          {t("clearFilters")}
        </Link>
      )}
    </div>
  )
}
