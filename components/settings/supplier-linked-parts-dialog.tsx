"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { X, Loader2, Package } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type PartRow = { id: string; code: string; name: string; isActive: boolean }

export function SupplierLinkedPartsDialog({
  open,
  onClose,
  supplierId,
  supplierCode,
  supplierName,
}: {
  open: boolean
  onClose: () => void
  supplierId: string | null
  supplierCode: string
  supplierName: string
}) {
  const [loading, setLoading] = useState(false)
  const [parts, setParts] = useState<PartRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const load = useCallback(async () => {
    if (!supplierId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/master-data/suppliers/${supplierId}/spare-parts`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error?.message || "โหลดไม่สำเร็จ")
        setParts([])
        return
      }
      setParts(json.parts ?? [])
    } catch {
      setError("เครือข่ายผิดพลาด")
      setParts([])
    } finally {
      setLoading(false)
    }
  }, [supplierId])

  useEffect(() => {
    if (!open) {
      setSearch("")
      setParts([])
      setError(null)
      return
    }
    void load()
  }, [open, load])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return parts
    return parts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q)
    )
  }, [parts, search])

  if (!open || !supplierId) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-parts-title"
        className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[min(85vh,640px)] flex flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h2 id="supplier-parts-title" className="font-semibold text-slate-800 truncate">
              อะไหล่ที่ผูกกับซัพพลายเออร์
            </h2>
            <p className="text-sm text-slate-500 mt-0.5 truncate">
              <span className="font-mono text-slate-600">{supplierCode}</span> · {supplierName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
            aria-label="ปิด"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-slate-100 shrink-0">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหารหัสหรือชื่ออะไหล่..."
            className="h-9"
            disabled={loading}
          />
          {!loading && !error && (
            <p className="text-xs text-slate-500 mt-2">
              ทั้งหมด {parts.length} รายการ
              {search.trim() && filtered.length !== parts.length && (
                <span className="text-slate-400"> · แสดง {filtered.length} รายการ</span>
              )}
            </p>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
              <span className="text-sm">กำลังโหลด...</span>
            </div>
          )}
          {!loading && error && (
            <p className="text-sm text-red-600 text-center py-8 px-4">{error}</p>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Package className="w-10 h-10 opacity-30 mb-2" />
              <p className="text-sm">
                {parts.length === 0 ? "ยังไม่มีอะไหล่ผูกกับซัพพลายเออร์นี้" : "ไม่พบรายการที่ตรงกับการค้นหา"}
              </p>
            </div>
          )}
          {!loading && !error && filtered.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {filtered.map((p) => (
                <li key={p.id} className="px-3 py-2.5 hover:bg-slate-50/80 rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 leading-snug">{p.name}</p>
                      <p className="text-xs font-mono text-slate-500 mt-0.5">{p.code}</p>
                    </div>
                    {!p.isActive && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                        ปิด
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-100 shrink-0 flex justify-end">
          <Button variant="secondary" type="button" onClick={onClose}>
            ปิด
          </Button>
        </div>
      </div>
    </div>
  )
}
