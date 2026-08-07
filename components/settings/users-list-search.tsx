"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"

const DEBOUNCE_MS = 300

export function UsersListSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlSearch = searchParams.get("search") ?? ""
  const [value, setValue] = useState(urlSearch)

  useEffect(() => {
    setValue(urlSearch)
  }, [urlSearch])

  useEffect(() => {
    const trimmed = value.trim()
    const current = (searchParams.get("search") ?? "").trim()
    if (trimmed === current) return

    const timer = window.setTimeout(() => {
      const q = new URLSearchParams(searchParams.toString())
      q.delete("page")
      if (trimmed) q.set("search", trimmed)
      else q.delete("search")
      const s = q.toString()
      router.push(s ? `${pathname}?${s}` : pathname)
    }, DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [value, pathname, router, searchParams])

  return (
    <div className="relative w-full max-w-xl">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="ค้นหาชื่อ, username, อีเมล, รหัสพนักงาน..."
        className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="ล้างคำค้นหา"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
