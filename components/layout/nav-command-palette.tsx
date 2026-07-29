"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import type { ModuleNavNode } from "@/shared/navigation/moduleRegistry"
import { flattenNavForPalette } from "@/shared/navigation/flattenNav"
import { isExternalHref } from "@/shared/navigation/isExternalHref"
import { cn } from "@/lib/utils"

export default function NavCommandPalette({ navItems }: { navItems: ModuleNavNode[] }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const router = useRouter()

  const flat = useMemo(() => flattenNavForPalette(navItems), [navItems])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return flat
    return flat.filter((i) => i.searchText.includes(q))
  }, [flat, query])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", down)
    return () => window.removeEventListener("keydown", down)
  }, [])

  useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  useEffect(() => {
    if (!open) return
    const up = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keyup", up)
    return () => window.removeEventListener("keyup", up)
  }, [open])

  const go = useCallback(
    (href: string) => {
      setOpen(false)
      if (isExternalHref(href)) {
        window.open(href, "_blank", "noopener,noreferrer")
        return
      }
      router.push(href)
    },
    [router]
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border bg-muted px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="ค้นหาเมนู (Ctrl+K หรือ ⌘K)"
      >
        <Search className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums">Ctrl+K</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 pt-[12vh] px-4"
          role="dialog"
          aria-modal="true"
          aria-label="ค้นหาเมนู"
          onMouseDown={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border p-3">
              <input
                type="search"
                autoFocus
                placeholder="ค้นหาหน้า… (ชื่อ, path, โมดูล)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full border-0 bg-transparent px-1 py-1 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
              />
            </div>
            <ul className="max-h-[min(50vh,320px)] overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">ไม่พบรายการ</li>
              ) : (
                filtered.map((item, idx) => (
                  <li key={`${item.href}-${idx}`}>
                    <button
                      type="button"
                      onClick={() => go(item.href)}
                      className={cn(
                        "w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors",
                        "flex flex-col gap-0.5"
                      )}
                    >
                      <span className="font-medium text-foreground">{item.label}</span>
                      <span className="text-xs text-muted-foreground font-mono truncate">{item.href}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  )
}
