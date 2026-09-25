"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import type { DutyCatalogCategory } from "@/modules/hr"

/** โหลดรวมข้อที่ปิดแล้ว เพื่อให้ข้อที่เคยติ๊กไว้ยังแสดงและเอาออกได้ */
export function useDutyCatalog(enabled = true) {
  const [catalog, setCatalog] = useState<DutyCatalogCategory[] | null>(null)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    fetch("/api/hr/duties?includeInactive=true")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json: { data?: DutyCatalogCategory[] }) => {
        if (!cancelled) setCatalog(json.data ?? [])
      })
      .catch(() => {
        if (!cancelled) setCatalog([])
      })
    return () => {
      cancelled = true
    }
  }, [enabled])
  return catalog
}

export function activeDutyIds(catalog: DutyCatalogCategory[] | null, ids: string[]): string[] {
  if (!catalog) return ids
  const active = new Set(
    catalog.filter((c) => c.isActive).flatMap((c) => c.items.filter((i) => i.isActive).map((i) => i.id))
  )
  return ids.filter((id) => active.has(id))
}

export function DutyPicker({
  catalog,
  selected,
  onChange,
  disabled,
}: {
  catalog: DutyCatalogCategory[] | null
  selected: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}) {
  const [search, setSearch] = useState("")
  const chosen = useMemo(() => new Set(selected), [selected])

  const groups = useMemo(() => {
    if (!catalog) return []
    const q = search.trim().toLowerCase()
    return catalog
      .map((category) => {
        const categoryHit = q ? category.name.toLowerCase().includes(q) : true
        const items = category.items.filter((item) => {
          const usable = item.isActive && category.isActive
          if (!usable && !chosen.has(item.id)) return false
          return categoryHit || item.name.toLowerCase().includes(q)
        })
        return { category, items }
      })
      .filter((group) => group.items.length > 0)
  }, [catalog, search, chosen])

  function toggle(id: string) {
    onChange(chosen.has(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  if (!catalog) return <p className="text-xs text-muted-foreground">กำลังโหลดสมุดหน้าที่…</p>
  if (catalog.length === 0) {
    return <p className="text-xs text-muted-foreground">สมุดหน้าที่ยังว่าง — ผู้ดูแลระบบเพิ่มได้ที่แท็บสมุดหน้าที่</p>
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-500 dark:bg-slate-950/55"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหารายการ"
        />
        <span className="shrink-0 text-xs text-muted-foreground">เลือก {selected.length}</span>
      </div>
      <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-border px-3 py-2">
        {groups.length === 0 && <p className="text-xs text-muted-foreground">ไม่พบรายการที่ตรงคำค้น</p>}
        {groups.map(({ category, items }) => (
          <div key={category.id}>
            <p className="text-xs font-semibold text-foreground">{category.name}</p>
            <ul className="mt-1 space-y-1">
              {items.map((item) => {
                const inactive = !item.isActive || !category.isActive
                return (
                  <li key={item.id}>
                    <label className="flex items-start gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        disabled={disabled}
                        checked={chosen.has(item.id)}
                        onChange={() => toggle(item.id)}
                      />
                      <span className={inactive ? "text-muted-foreground" : ""}>{item.name}</span>
                      {inactive && <Badge variant="outline">ปิดใช้งาน</Badge>}
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
