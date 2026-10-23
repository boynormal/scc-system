"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { cn } from "@/lib/utils"

type Option = { id: string; name: string }

/** One-row filter bar; every field is optional and writes to the URL query. */
export function FuelFilters({
  branches,
  fuelTypes,
  tanks,
  txnTypes,
  dates = false,
  search = false,
}: {
  branches?: Option[]
  fuelTypes?: Option[]
  tanks?: Option[]
  txnTypes?: string[]
  dates?: boolean
  search?: boolean
}) {
  const t = useTranslations("fuel")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [text, setText] = useState(searchParams.get("search") || "")
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      params.delete("page")
      startTransition(() => router.push(`${pathname}?${params.toString()}`))
    },
    [pathname, router, searchParams]
  )

  useEffect(() => {
    if (!search) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      if (text !== (searchParams.get("search") || "")) setParam("search", text)
    }, 500)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [search, text, searchParams, setParam])

  const keys = ["branchId", "fuelTypeId", "tankId", "type", "dateFrom", "dateTo", "search"]
  const hasFilters = keys.some((k) => searchParams.get(k))
  const view = searchParams.get("view")

  return (
    <div className={cn("flex w-full flex-wrap items-end gap-2", isPending && "pointer-events-none opacity-70")}>
      {search && (
        <div className="min-w-48 flex-1">
          <Input
            aria-label={t("searchPlaceholder")}
            icon={<Search className="h-4 w-4" />}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("searchPlaceholder")}
          />
        </div>
      )}
      {branches && branches.length > 1 && (
        <div className="w-44">
          <Select
            aria-label={t("branch")}
            defaultValue={searchParams.get("branchId") || ""}
            onChange={(e) => setParam("branchId", e.target.value)}
            placeholder={t("allBranches")}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
          />
        </div>
      )}
      {fuelTypes && (
        <div className="w-44">
          <Select
            aria-label={t("fuelType")}
            defaultValue={searchParams.get("fuelTypeId") || ""}
            onChange={(e) => setParam("fuelTypeId", e.target.value)}
            placeholder={t("allTypes")}
            options={fuelTypes.map((f) => ({ value: f.id, label: f.name }))}
          />
        </div>
      )}
      {tanks && (
        <div className="w-52">
          <Select
            aria-label={t("tank")}
            defaultValue={searchParams.get("tankId") || ""}
            onChange={(e) => setParam("tankId", e.target.value)}
            placeholder={t("allTanks")}
            options={tanks.map((x) => ({ value: x.id, label: x.name }))}
          />
        </div>
      )}
      {txnTypes && (
        <div className="w-40">
          <Select
            aria-label={t("type")}
            defaultValue={searchParams.get("type") || ""}
            onChange={(e) => setParam("type", e.target.value)}
            placeholder={t("filterAll")}
            options={txnTypes.map((x) => ({ value: x, label: t(`type_${x}`) }))}
          />
        </div>
      )}
      {dates && (
        <>
          <div className="w-40">
            <Input
              type="date"
              aria-label={t("dateFrom")}
              defaultValue={searchParams.get("dateFrom") || ""}
              onChange={(e) => setParam("dateFrom", e.target.value)}
            />
          </div>
          <div className="w-40">
            <Input
              type="date"
              aria-label={t("dateTo")}
              defaultValue={searchParams.get("dateTo") || ""}
              onChange={(e) => setParam("dateTo", e.target.value)}
            />
          </div>
        </>
      )}
      {hasFilters && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setText("")
            startTransition(() => router.push(view ? `${pathname}?view=${view}` : pathname))
          }}
        >
          {t("clearFilters")}
        </Button>
      )}
    </div>
  )
}
