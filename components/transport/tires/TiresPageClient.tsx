"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Filter, Loader2, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react"
import { GlassButton, GlassCard, GlassInput } from "@/components/glass"
import { WheelLayoutDiagram } from "@/components/transport/WheelLayoutDiagram"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"
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
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"
import { cn } from "@/lib/utils"
import { transportFilterTriggerClass } from "@/components/transport/toolbar"
import { useTypeConfirm } from "@/components/ui/type-confirm"

type TireWheelItem = {
  position: number
  workType: TireWorkType
}

type TireRow = {
  id: string
  tireNumber: string
  workDate: string
  wheels: TireWheelItem[]
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
  if (value == null || value === "") return "ยังไม่มียอดอ้างอิง"
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return "ยังไม่มียอดอ้างอิง"
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

function normalizeWheelsList(wheels: TireWheelItem[]): TireWheelItem[] {
  return [...wheels].sort((a, b) => a.position - b.position)
}

function summarizeWorkTypes(wheels: TireWheelItem[]): string {
  const counts = new Map<TireWorkType, number>()
  for (const w of wheels) {
    counts.set(w.workType, (counts.get(w.workType) ?? 0) + 1)
  }
  return TIRE_WORK_TYPES.filter((t) => counts.has(t))
    .map((t) => {
      const n = counts.get(t)!
      const label = TIRE_WORK_TYPE_LABELS[t]
      return n > 1 ? `${label}×${n}` : label
    })
    .join(", ")
}

function formatPositions(wheels: TireWheelItem[]): string {
  return normalizeWheelsList(wheels)
    .map((w) => w.position)
    .join(", ")
}

export function TiresPageClient() {
  const t = useTranslations("transport")
  const confirmType = useTypeConfirm()
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const pendingWheelsRef = useRef<TireWheelItem[] | null>(null)
  const defaultWorkTypeRef = useRef<TireWorkType>("change")

  const [formVehicleId, setFormVehicleId] = useState("")
  const [workDate, setWorkDate] = useState(formatBangkokYmd())
  const [wheels, setWheels] = useState<TireWheelItem[]>([])
  const [cost, setCost] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<TransportPaymentMethodOption>("cash")
  const [notes, setNotes] = useState("")
  const [layoutInfo, setLayoutInfo] = useState<LayoutInfo | null>(null)
  const [layoutLoading, setLayoutLoading] = useState(false)
  const [layoutError, setLayoutError] = useState<string | null>(null)

  const selectedPositions = useMemo(() => wheels.map((w) => w.position), [wheels])

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
      const json = await fetchJson<{ data?: TireRow[] }>(`/api/transport/tires?${qs}`)
      setItems(json.data ?? [])
    } catch (err) {
      setItems([])
      setError(err instanceof ClientFetchError ? err.message : t("loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [vehicleFilter, fromDate, toDate, t])

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
      setWheels([])
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
        if (pendingWheelsRef.current) {
          setWheels(normalizeWheelsList(pendingWheelsRef.current))
          pendingWheelsRef.current = null
        } else {
          setWheels([])
        }
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

  const resetForm = () => {
    setEditingId(null)
    pendingWheelsRef.current = null
    defaultWorkTypeRef.current = "change"
    setFormVehicleId("")
    setWorkDate(formatBangkokYmd())
    setWheels([])
    setCost("")
    setPaymentMethod("cash")
    setNotes("")
    setLayoutInfo(null)
    setLayoutError(null)
  }

  const startEdit = (row: TireRow) => {
    const nextWheels = normalizeWheelsList(Array.isArray(row.wheels) ? row.wheels : [])
    pendingWheelsRef.current = nextWheels
    if (nextWheels[0]) defaultWorkTypeRef.current = nextWheels[0].workType
    setEditingId(row.id)
    setFormVehicleId(row.vehicle.id)
    setWorkDate(formatBangkokYmd(new Date(row.workDate)))
    setWheels(nextWheels)
    setCost(row.cost != null && row.cost !== "" ? String(row.cost) : "")
    setPaymentMethod(row.paymentMethod ?? "cash")
    setNotes(row.notes ?? "")
  }

  const toggleWheel = (position: number) => {
    setWheels((prev) => {
      const exists = prev.find((w) => w.position === position)
      if (exists) {
        return prev.filter((w) => w.position !== position)
      }
      return normalizeWheelsList([
        ...prev,
        { position, workType: defaultWorkTypeRef.current },
      ])
    })
  }

  const setWheelWorkType = (position: number, workType: TireWorkType) => {
    defaultWorkTypeRef.current = workType
    setWheels((prev) =>
      prev.map((w) => (w.position === position ? { ...w, workType } : w))
    )
  }

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

  const buildPayload = () => {
    if (!formVehicleId) {
      alert("กรุณาเลือกรถ")
      return null
    }
    if (wheels.length === 0) {
      alert("กรุณาเลือกตำแหน่งล้ออย่างน้อย 1 ล้อ")
      return null
    }
    if (!workDate) {
      alert("กรุณาเลือกวันที่")
      return null
    }

    const costRaw = cost.trim()
    let costValue: number | null = null
    if (costRaw) {
      costValue = Number(costRaw.replace(/,/g, ""))
      if (Number.isNaN(costValue) || costValue < 0) {
        alert("ยอดอ้างอิงไม่ถูกต้อง")
        return null
      }
    }
    if (costValue != null && costValue > 0 && !paymentMethod) {
      alert("กรุณาเลือกวิธีจ่าย")
      return null
    }

    return {
      vehicleId: formVehicleId,
      workDate,
      wheels: normalizeWheelsList(wheels),
      cost: costValue,
      paymentMethod: costValue != null && costValue > 0 ? paymentMethod : null,
      notes: notes.trim() || null,
    }
  }

  const handleCreate = async () => {
    const payload = buildPayload()
    if (!payload) return

    setSaving(true)
    try {
      const res = await fetch("/api/transport/tires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        alert(typeof json.error === "string" ? json.error : json.error?.message ?? "บันทึกไม่สำเร็จ")
        return
      }
      setCost("")
      setNotes("")
      setWheels([])
      await loadItems()
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingId) return
    const payload = buildPayload()
    if (!payload) return

    setSaving(true)
    try {
      const res = await fetch(`/api/transport/tires/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        alert(typeof json.error === "string" ? json.error : json.error?.message ?? "บันทึกไม่สำเร็จ")
        return
      }
      resetForm()
      await loadItems()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirmType({ message: "ลบรายการนี้?" })
    if (!ok) return
    const res = await fetch(`/api/transport/tires/${id}`, { method: "DELETE" })
    if (res.ok) {
      if (editingId === id) resetForm()
      await loadItems()
    } else {
      const json = await res.json()
      alert(typeof json.error === "string" ? json.error : json.error?.message ?? "ลบไม่สำเร็จ")
    }
  }

  return (
    <div className="min-w-0 space-y-6 p-4 md:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative" ref={popupRef}>
            <button
              type="button"
              onClick={openFilterPopup}
              className={transportFilterTriggerClass(filterOpen)}
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
            title={t("refresh")}
            aria-label={t("refresh")}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground sm:hidden">{filterSummary}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <GlassCard className="space-y-4 h-fit">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">
              {editingId ? "แก้ไขรายการยาง" : "บันทึกรายการใหม่"}
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                ยกเลิกแก้ไข
              </button>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">รถ *</label>
            <select
              value={formVehicleId}
              onChange={(e) => {
                pendingWheelsRef.current = null
                setFormVehicleId(e.target.value)
              }}
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
            <label className="mb-1 block text-xs text-muted-foreground">ยอดอ้างอิง (บาท)</label>
            <GlassInput
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="ถ้าทราบ เพื่อนำเข้า Finance ภายหลัง"
              className="h-9"
            />
          </div>
          {Number(cost.replace(/,/g, "")) > 0 ? (
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
          ) : null}
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">หมายเหตุ</label>
            <GlassInput
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="text-xs text-muted-foreground">
              ตำแหน่งล้อ{" "}
              {wheels.length > 0
                ? `(เลือกแล้ว: ${formatPositions(wheels)})`
                : "(คลิกเลือกได้หลายล้อ)"}
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
                selectedPositions={selectedPositions}
                onTogglePosition={toggleWheel}
                compact
              />
            )}
            {!formVehicleId && !layoutLoading && (
              <p className="text-sm text-muted-foreground">เลือกรถเพื่อแสดงแผนผัง</p>
            )}
            {wheels.length > 0 && (
              <div className="space-y-2 border-t border-border pt-3">
                <div className="text-xs font-medium text-muted-foreground">ประเภทงานต่อล้อ</div>
                {normalizeWheelsList(wheels).map((w) => (
                  <div key={w.position} className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-sm font-medium">ล้อ {w.position}</span>
                    <select
                      value={w.workType}
                      onChange={(e) =>
                        setWheelWorkType(w.position, e.target.value as TireWorkType)
                      }
                      className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm"
                    >
                      {TIRE_WORK_TYPES.map((wt) => (
                        <option key={wt} value={wt}>
                          {TIRE_WORK_TYPE_LABELS[wt]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
          <GlassButton
            onClick={editingId ? handleUpdate : handleCreate}
            disabled={saving}
            icon={
              saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : editingId ? (
                <Pencil className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )
            }
          >
            {editingId ? "บันทึกการแก้ไข" : "บันทึก"}
          </GlassButton>
        </GlassCard>

        <div className="space-y-4 min-w-0">
          <GlassCard padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[820px]">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">เอกสาร</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">วันที่</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">รถ</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">ตำแหน่ง</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">ประเภท</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">ยอดอ้างอิง</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">วิธีจ่าย</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">หมายเหตุ</th>
                    <th className="px-4 py-3 w-24"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && (
                    <tr>
                      <td colSpan={9} className="px-2 py-4">
                        <LoadingState title={t("tiresLoading")} className="py-10" />
                      </td>
                    </tr>
                  )}
                  {!loading && error && (
                    <tr>
                      <td colSpan={9} className="px-2 py-4">
                        <ErrorState
                          title={t("loadFailed")}
                          description={error}
                          onRetry={() => void loadItems()}
                          className="py-10"
                        />
                      </td>
                    </tr>
                  )}
                  {!loading && !error && items.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                        {t("tiresEmpty")}
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    !error &&
                    items.map((row) => {
                      const rowWheels = Array.isArray(row.wheels) ? row.wheels : []
                      return (
                        <tr
                          key={row.id}
                          className={
                            editingId === row.id
                              ? "bg-cyan-50/70 dark:bg-cyan-950/30"
                              : "hover:bg-muted/60"
                          }
                        >
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-sm font-semibold tabular-nums">
                            {row.tireNumber}
                          </td>
                          <td className="px-4 py-3">{formatWorkDate(row.workDate)}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{row.vehicle.plateNumber}</div>
                            <div className="text-xs text-muted-foreground">{row.vehicle.name}</div>
                          </td>
                          <td className="px-4 py-3">{formatPositions(rowWheels) || "—"}</td>
                          <td className="px-4 py-3">{summarizeWorkTypes(rowWheels) || "—"}</td>
                          <td className="px-4 py-3">{formatCost(row.cost)}</td>
                          <td className="px-4 py-3">
                            {row.paymentMethod
                              ? TRANSPORT_PAYMENT_METHOD_LABELS[row.paymentMethod]
                              : "—"}
                          </td>
                          <td className="max-w-[180px] px-4 py-3">
                            <span
                              className="line-clamp-2 text-muted-foreground"
                              title={row.notes ?? undefined}
                            >
                              {row.notes?.trim() ? row.notes : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => startEdit(row)}
                                className="p-1.5 text-muted-foreground hover:text-cyan-700"
                                title="แก้ไข"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(row.id)}
                                className="p-1.5 text-muted-foreground hover:text-red-600"
                                title="ลบ"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
