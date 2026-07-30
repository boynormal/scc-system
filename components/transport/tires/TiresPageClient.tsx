"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Filter, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react"
import { GlassButton, GlassCard, GlassInput } from "@/components/glass"
import { WheelLayoutDiagram } from "@/components/transport/WheelLayoutDiagram"
import {
  TIRE_WORK_TYPE_LABELS,
  TIRE_WORK_TYPES,
  type TireWorkType,
} from "@/modules/transport/application/tire-options"
import {
  TRANSPORT_PAYMENT_METHOD_LABELS,
  type TransportPaymentMethodOption,
} from "@/modules/transport/application/payment-options"
import type { WheelLayout } from "@/modules/transport/application/vehicle-wheel-layouts"
import { formatBangkokYmd } from "@/modules/transport/application/transport-date-utils"
import { cn } from "@/lib/utils"

type TireRow = {
  id: string
  workDate: string
  wheelPosition: number
  workType: TireWorkType
  cost: string | number | null
  paymentMethod: TransportPaymentMethodOption | null
  notes: string | null
  vehicle: {
    id: string
    plateNumber: string
    name: string
    vehicleType: string
  }
  branch: { id: string; name: string }
}

type VehicleOption = {
  id: string
  plateNumber: string
  name: string
  vehicleType: string
}

type LayoutInfo = {
  wheelCount: number
  wheelLayout: WheelLayout
  vehicle: VehicleOption
}

function formatCost(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—"
  const n = typeof value === "number" ? value : Number(value)
  if (Number.isNaN(n)) return "—"
  return n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function formatWorkDate(value: string): string {
  return new Date(value).toLocaleDateString("th-TH", { dateStyle: "short" })
}

function formatYmdShort(ymd: string) {
  const [y, m, d] = ymd.split("-")
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y.slice(2)}`
}

export function TiresPageClient() {
  const [items, setItems] = useState<TireRow[]>([])
  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [vehicleFilter, setVehicleFilter] = useState("")
  const [draftFrom, setDraftFrom] = useState("")
  const [draftTo, setDraftTo] = useState("")
  const [draftVehicle, setDraftVehicle] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)

  const [formVehicleId, setFormVehicleId] = useState("")
  const [workDate, setWorkDate] = useState(formatBangkokYmd())
  const [wheelPosition, setWheelPosition] = useState<number | null>(null)
  const [workType, setWorkType] = useState<(typeof TIRE_WORK_TYPES)[number]>("change")
  const [cost, setCost] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<TransportPaymentMethodOption>("cash")
  const [notes, setNotes] = useState("")
  const [layoutInfo, setLayoutInfo] = useState<LayoutInfo | null>(null)
  const [layoutLoading, setLayoutLoading] = useState(false)
  const [layoutError, setLayoutError] = useState<string | null>(null)

  const loadVehicles = useCallback(async () => {
    try {
      const res = await fetch("/api/transport/vehicles")
      const json = await res.json()
      if (!res.ok) return
      const list = (json.data ?? []) as VehicleOption[]
      setVehicles([...list].sort((a, b) => a.plateNumber.localeCompare(b.plateNumber, "th")))
    } catch {
      // non-blocking
    }
  }, [])

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (vehicleFilter) qs.set("vehicleId", vehicleFilter)
      if (fromDate) qs.set("from", fromDate)
      if (toDate) qs.set("to", toDate)
      const res = await fetch(`/api/transport/tires?${qs}`)
      const json = await res.json()
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : json.error?.message ?? "โหลดไม่สำเร็จ")
        setItems([])
      } else {
        setItems(json.data ?? [])
      }
    } catch {
      setError("โหลดไม่สำเร็จ")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [vehicleFilter, fromDate, toDate])

  useEffect(() => {
    loadVehicles()
  }, [loadVehicles])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  useEffect(() => {
    if (!filterOpen) return
    const onDown = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [filterOpen])

  useEffect(() => {
    if (!formVehicleId) {
      setLayoutInfo(null)
      setLayoutError(null)
      setWheelPosition(null)
      return
    }
    let cancelled = false
    ;(async () => {
      setLayoutLoading(true)
      setLayoutError(null)
      try {
        const res = await fetch(`/api/transport/tires?layoutVehicleId=${formVehicleId}`)
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setLayoutInfo(null)
          setLayoutError(
            typeof json.error === "string" ? json.error : json.error?.message ?? "โหลดแผนผังไม่สำเร็จ"
          )
          return
        }
        setLayoutInfo(json.data)
        setWheelPosition(null)
      } catch {
        if (!cancelled) {
          setLayoutInfo(null)
          setLayoutError("โหลดแผนผังไม่สำเร็จ")
        }
      } finally {
        if (!cancelled) setLayoutLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [formVehicleId])

  const openFilterPopup = () => {
    setDraftFrom(fromDate)
    setDraftTo(toDate)
    setDraftVehicle(vehicleFilter)
    setFilterError(null)
    setFilterOpen((o) => !o)
  }

  const applyFilters = () => {
    if (draftFrom && draftTo && draftFrom > draftTo) {
      setFilterError("วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด")
      return
    }
    setFilterError(null)
    setFromDate(draftFrom)
    setToDate(draftTo)
    setVehicleFilter(draftVehicle)
    setFilterOpen(false)
  }

  const clearFilters = () => {
    setDraftFrom("")
    setDraftTo("")
    setFromDate("")
    setToDate("")
    setDraftVehicle("")
    setVehicleFilter("")
    setFilterError(null)
    setFilterOpen(false)
  }

  const selectedVehicle = vehicles.find((v) => v.id === vehicleFilter)

  const filterSummary = (() => {
    const parts: string[] = []
    if (fromDate && toDate) {
      parts.push(`${formatYmdShort(fromDate)}–${formatYmdShort(toDate)}`)
    } else if (fromDate) {
      parts.push(`ตั้งแต่ ${formatYmdShort(fromDate)}`)
    } else if (toDate) {
      parts.push(`ถึง ${formatYmdShort(toDate)}`)
    } else {
      parts.push("ไม่จำกัดวัน")
    }
    parts.push(selectedVehicle ? selectedVehicle.plateNumber : "ทุกคัน")
    return parts.join(" · ")
  })()

  const vehicleOptions = useMemo(
    () =>
      vehicles.map((v) => ({
        ...v,
        label: `${v.plateNumber} — ${v.name}`,
      })),
    [vehicles]
  )

  const handleCreate = async () => {
    if (!formVehicleId) return alert("กรุณาเลือกรถ")
    if (!wheelPosition) return alert("กรุณาเลือกตำแหน่งล้อ")
    if (!workDate) return alert("กรุณาเลือกวันที่")

    const costRaw = cost.trim()
    let costValue: number | null = null
    if (costRaw) {
      costValue = Number(costRaw.replace(/,/g, ""))
      if (Number.isNaN(costValue) || costValue < 0) return alert("ค่าใช้จ่ายไม่ถูกต้อง")
    }
    if (costValue != null && costValue > 0 && !paymentMethod) {
      return alert("กรุณาเลือกวิธีจ่าย")
    }

    setSaving(true)
    try {
      const res = await fetch("/api/transport/tires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: formVehicleId,
          workDate,
          wheelPosition,
          workType,
          cost: costValue,
          paymentMethod: costValue != null && costValue > 0 ? paymentMethod : null,
          notes: notes.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        alert(typeof json.error === "string" ? json.error : json.error?.message ?? "บันทึกไม่สำเร็จ")
        return
      }
      setCost("")
      setNotes("")
      setWheelPosition(null)
      await loadItems()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("ลบรายการนี้?")) return
    const res = await fetch(`/api/transport/tires/${id}`, { method: "DELETE" })
    if (res.ok) loadItems()
    else {
      const json = await res.json()
      alert(typeof json.error === "string" ? json.error : json.error?.message ?? "ลบไม่สำเร็จ")
    }
  }

  return (
    <div className="-m-6 space-y-6 p-4 md:p-6 w-auto min-w-0">
      <div>
        <h1 className="text-xl font-semibold text-foreground">จัดการยาง</h1>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">
            บันทึกเปลี่ยนยาง / ปะยาง / ซ่อมยาง ตามตำแหน่งล้อของแต่ละคัน
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative" ref={popupRef}>
              <button
                type="button"
                onClick={openFilterPopup}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  filterOpen
                    ? "border-cyan-500 bg-cyan-50 text-cyan-800"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Filter className="h-3.5 w-3.5" />
                ตัวกรอง
                <span className="hidden text-xs opacity-80 sm:inline">· {filterSummary}</span>
              </button>

              {filterOpen && (
                <div className="absolute left-0 z-30 mt-2 w-[min(100vw-2rem,320px)] rounded-xl border border-border bg-card p-3 shadow-lg">
                  <p className="mb-2 text-xs font-semibold text-foreground">ตัวกรองเพิ่มเติม</p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[11px] text-muted-foreground">จากวันที่</label>
                        <input
                          type="date"
                          value={draftFrom}
                          onChange={(e) => setDraftFrom(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-muted-foreground">ถึงวันที่</label>
                        <input
                          type="date"
                          value={draftTo}
                          onChange={(e) => setDraftTo(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-muted-foreground">รถ</label>
                      <select
                        value={draftVehicle}
                        onChange={(e) => setDraftVehicle(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        <option value="">ทุกคัน</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.plateNumber} — {v.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {filterError && <p className="text-xs text-red-600">{filterError}</p>}
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                      >
                        ล้าง
                      </button>
                      <GlassButton onClick={applyFilters}>ใช้ตัวกรอง</GlassButton>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => loadItems()}
              disabled={loading}
              title="รีเฟรช"
              aria-label="รีเฟรช"
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground sm:hidden">{filterSummary}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <GlassCard className="space-y-4 h-fit">
          <div className="text-sm font-semibold">บันทึกรายการใหม่</div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">รถ *</label>
            <select
              value={formVehicleId}
              onChange={(e) => setFormVehicleId(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">เลือกรถ</option>
              {vehicleOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">วันที่ *</label>
            <GlassInput
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">ประเภท *</label>
            <select
              value={workType}
              onChange={(e) => setWorkType(e.target.value as (typeof TIRE_WORK_TYPES)[number])}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              {TIRE_WORK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TIRE_WORK_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">ค่าใช้จ่าย</label>
            <GlassInput
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="เช่น 14500"
              className="h-9"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">วิธีจ่าย</label>
            <div className="flex gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="tirePaymentMethod"
                  checked={paymentMethod === "cash"}
                  onChange={() => setPaymentMethod("cash")}
                />
                เงินสด
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="tirePaymentMethod"
                  checked={paymentMethod === "credit"}
                  onChange={() => setPaymentMethod("credit")}
                />
                เครดิต
              </label>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">หมายเหตุ</label>
            <GlassInput
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 text-xs text-muted-foreground">
              ตำแหน่งล้อ {wheelPosition ? `(เลือกแล้ว: ${wheelPosition})` : "(คลิกเลือก)"}
            </div>
            {layoutLoading && (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
              </div>
            )}
            {!layoutLoading && layoutError && (
              <p className="text-sm text-red-600">{layoutError}</p>
            )}
            {!layoutLoading && !layoutError && layoutInfo && (
              <WheelLayoutDiagram
                layout={layoutInfo.wheelLayout}
                selectedPosition={wheelPosition}
                onSelectPosition={setWheelPosition}
                compact
              />
            )}
            {!formVehicleId && !layoutLoading && (
              <p className="text-sm text-muted-foreground">เลือกรถเพื่อแสดงแผนผัง</p>
            )}
          </div>
          <GlassButton
            onClick={handleCreate}
            disabled={saving}
            icon={saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          >
            บันทึก
          </GlassButton>
        </GlassCard>

        <div className="space-y-4 min-w-0">
          <GlassCard padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[640px]">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">วันที่</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">รถ</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">ตำแหน่ง</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">ประเภท</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">ค่าใช้จ่าย</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">วิธีจ่าย</th>
                    <th className="px-4 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center">
                        <Loader2 className="inline h-5 w-5 animate-spin text-cyan-500" />
                      </td>
                    </tr>
                  )}
                  {!loading && error && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-red-600">
                        {error}
                      </td>
                    </tr>
                  )}
                  {!loading && !error && items.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                        ยังไม่มีข้อมูล
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    !error &&
                    items.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/60">
                        <td className="px-4 py-3">{formatWorkDate(row.workDate)}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{row.vehicle.plateNumber}</div>
                          <div className="text-xs text-muted-foreground">{row.vehicle.name}</div>
                        </td>
                        <td className="px-4 py-3">{row.wheelPosition}</td>
                        <td className="px-4 py-3">{TIRE_WORK_TYPE_LABELS[row.workType]}</td>
                        <td className="px-4 py-3">{formatCost(row.cost)}</td>
                        <td className="px-4 py-3">
                          {row.paymentMethod
                            ? TRANSPORT_PAYMENT_METHOD_LABELS[row.paymentMethod]
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(row.id)}
                            className="p-1.5 text-muted-foreground hover:text-red-600"
                            title="ลบ"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
