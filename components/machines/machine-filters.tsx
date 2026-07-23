"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import Link from "next/link"
import { useTransition, useState, useEffect, useRef } from "react"

interface MachineFiltersProps {
  branches: { id: string; name: string }[]
  categories: { id: string; name: string }[]
}

export function MachineFilters({ branches, categories }: MachineFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  
  const [search, setSearch] = useState(searchParams.get("search") || "")
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  // Auto search typed text with debounce
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
  }, [search])

  const hasFilters = searchParams.get("search") || searchParams.get("categoryId") || searchParams.get("status") || searchParams.get("branchId")

  return (
    <div className={`flex flex-wrap gap-3 ${isPending ? "opacity-70 pointer-events-none" : ""}`}>
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อ, รหัส..."
          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <select
        defaultValue={searchParams.get("branchId") || ""}
        onChange={(e) => handleFilter("branchId", e.target.value)}
        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">ทุกสาขา</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
      <select
        defaultValue={searchParams.get("categoryId") || ""}
        onChange={(e) => handleFilter("categoryId", e.target.value)}
        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">ทุกหมวดหมู่</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <select
        defaultValue={searchParams.get("status") || ""}
        onChange={(e) => handleFilter("status", e.target.value)}
        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">ทุกสถานะ</option>
        <option value="active">ใช้งาน</option>
        <option value="under_maintenance">กำลังซ่อม</option>
        <option value="inactive">ไม่ใช้งาน</option>
        <option value="decommissioned">ปลดระวาง</option>
      </select>
      {hasFilters && (
        <Link
          href="/machines"
          onClick={() => setSearch("")}
          className="px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors"
        >
          ล้าง
        </Link>
      )}
    </div>
  )
}
