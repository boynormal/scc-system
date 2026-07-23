"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { X, Loader2, Wrench } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type MachineStatus = "active" | "inactive" | "under_maintenance" | "decommissioned"

type MachineRow = {
  id: string
  code: string
  name: string
  status: MachineStatus
  branch: { name: string }
}

function statusLabel(s: MachineStatus): string {
  switch (s) {
    case "active":
      return "ใช้งาน"
    case "under_maintenance":
      return "ซ่อมบำรุง"
    case "inactive":
      return "ไม่ใช้งาน"
    case "decommissioned":
      return "ปลดระวาง"
    default:
      return s
  }
}

function statusStyle(s: MachineStatus): string {
  switch (s) {
    case "active":
      return "bg-green-100 text-green-800"
    case "under_maintenance":
      return "bg-amber-100 text-amber-800"
    case "inactive":
      return "bg-slate-100 text-slate-600"
    case "decommissioned":
      return "bg-red-50 text-red-700"
    default:
      return "bg-slate-100 text-slate-600"
  }
}

export function CategoryLinkedMachinesDialog({
  open,
  onClose,
  categoryId,
  categoryCode,
  categoryName,
}: {
  open: boolean
  onClose: () => void
  categoryId: string | null
  categoryCode: string
  categoryName: string
}) {
  const [loading, setLoading] = useState(false)
  const [machines, setMachines] = useState<MachineRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const load = useCallback(async () => {
    if (!categoryId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/master-data/categories/${categoryId}/machines`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error?.message || "โหลดไม่สำเร็จ")
        setMachines([])
        return
      }
      setMachines(json.machines ?? [])
    } catch {
      setError("เครือข่ายผิดพลาด")
      setMachines([])
    } finally {
      setLoading(false)
    }
  }, [categoryId])

  useEffect(() => {
    if (!open) {
      setSearch("")
      setMachines([])
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
    if (!q) return machines
    return machines.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        m.branch.name.toLowerCase().includes(q)
    )
  }, [machines, search])

  if (!open || !categoryId) return null

  const headerCode = categoryCode || "—"

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
        aria-labelledby="category-machines-title"
        className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[min(85vh,640px)] flex flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h2 id="category-machines-title" className="font-semibold text-slate-800 truncate">
              เครื่องจักรในหมวดหมู่นี้
            </h2>
            <p className="text-sm text-slate-500 mt-0.5 truncate">
              <span className="font-mono text-slate-600">{headerCode}</span> · {categoryName}
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
            placeholder="ค้นหารหัส / ชื่อเครื่อง / สาขา..."
            className="h-9"
            disabled={loading}
          />
          {!loading && !error && (
            <p className="text-xs text-slate-500 mt-2">
              ทั้งหมด {machines.length} เครื่อง
              {search.trim() && filtered.length !== machines.length && (
                <span className="text-slate-400"> · แสดง {filtered.length} เครื่อง</span>
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
              <Wrench className="w-10 h-10 opacity-30 mb-2" />
              <p className="text-sm">
                {machines.length === 0
                  ? "ยังไม่มีเครื่องจักรในหมวดหมู่นี้"
                  : "ไม่พบรายการที่ตรงกับการค้นหา"}
              </p>
            </div>
          )}
          {!loading && !error && filtered.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {filtered.map((m) => (
                <li key={m.id} className="px-3 py-2.5 hover:bg-slate-50/80 rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 leading-snug">{m.name}</p>
                      <p className="text-xs font-mono text-slate-500 mt-0.5">{m.code}</p>
                      <p className="text-xs text-slate-400 mt-1">{m.branch.name}</p>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${statusStyle(m.status)}`}
                    >
                      {statusLabel(m.status)}
                    </span>
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
