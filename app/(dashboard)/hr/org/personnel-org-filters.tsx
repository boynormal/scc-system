"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"

type BranchOption = { id: string; name: string; code: string }

export function PersonnelOrgFilters({ branches }: { branches: BranchOption[] }) {
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

  const hasFilters = searchParams.get("search") || searchParams.get("isActive")

  const clearHref = (() => {
    const params = new URLSearchParams()
    const branchId = searchParams.get("branchId")
    const view = searchParams.get("view")
    if (branchId) params.set("branchId", branchId)
    if (view) params.set("view", view)
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  })()

  return (
    <div className={`flex flex-wrap gap-3 ${isPending ? "pointer-events-none opacity-70" : ""}`}>
      <div className="relative min-w-48 flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหา ชื่อ, รหัสรายชื่อ, กลุ่มงาน..."
          className="w-full rounded-lg border border-border py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <select
        value={searchParams.get("branchId") || ""}
        onChange={(e) => handleFilter("branchId", e.target.value)}
        className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {branches.length === 0 && <option value="">ไม่มีสาขา</option>}
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.code} — {b.name}
          </option>
        ))}
      </select>
      <select
        value={searchParams.get("isActive") || "true"}
        onChange={(e) => handleFilter("isActive", e.target.value === "true" ? "" : e.target.value)}
        className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="true">ใช้งาน</option>
        <option value="all">ทุกสถานะ</option>
        <option value="false">ปิดใช้งาน</option>
      </select>
      {hasFilters && (
        <Link
          href={clearHref}
          onClick={() => setSearch("")}
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/60"
        >
          ล้าง
        </Link>
      )}
    </div>
  )
}
