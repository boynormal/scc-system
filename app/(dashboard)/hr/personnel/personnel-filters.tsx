"use client"

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"

export function PersonnelFilters({
  departments,
  action,
}: {
  departments: { id: string; name: string; code: string | null }[]
  action?: ReactNode
}) {
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

  const branchId = searchParams.get("branchId") || ""
  const status = searchParams.get("isActive")
  const statusValue = status === "false" || status === "all" ? status : "true"
  const departmentId = searchParams.get("departmentId") || ""
  const hasFilters = Boolean(searchParams.get("search") || statusValue !== "true" || departmentId)
  const clearHref = branchId ? `/hr/personnel?branchId=${branchId}` : "/hr/personnel"

  return (
    <div className={`flex w-full items-center gap-2 ${isPending ? "pointer-events-none opacity-70" : ""}`}>
      <div className="relative min-w-48 flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหา ชื่อ, รหัสรายชื่อ, กลุ่มงาน..."
          className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <select
        value={statusValue}
        onChange={(e) => handleFilter("isActive", e.target.value === "true" ? "" : e.target.value)}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="true">ใช้งาน</option>
        <option value="false">ปิดใช้งาน</option>
        <option value="all">ทุกสถานะ</option>
      </select>
      <select
        value={departmentId}
        onChange={(e) => handleFilter("departmentId", e.target.value)}
        className="max-w-52 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">ทุกกลุ่มงาน</option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
          </option>
        ))}
      </select>
      <Link
        href={hasFilters ? clearHref : "/hr/personnel"}
        aria-disabled={!hasFilters}
        tabIndex={hasFilters ? 0 : -1}
        onClick={(event) => {
          if (!hasFilters) {
            event.preventDefault()
            return
          }
          setSearch("")
        }}
        className={cn(
          "shrink-0 rounded-lg border border-border px-4 py-2 text-sm text-foreground",
          hasFilters ? "hover:bg-muted/60" : "pointer-events-none opacity-40"
        )}
      >
        ล้าง
      </Link>
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </div>
  )
}
