"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import {
  Loader2,
  RefreshCw,
  Wrench,
  Play,
  CheckCircle2,
  ClipboardCheck,
  XCircle,
  Plus,
  Filter,
  Pencil,
} from "lucide-react"
import { GlassButton, GlassCard } from "@/components/glass"
import { RepairStatusBadge, type RepairStatus } from "@/components/transport/repairs/RepairStatusBadge"
import { ReportRepairModal } from "@/components/transport/repairs/ReportRepairModal"
import { EditRepairModal } from "@/components/transport/repairs/EditRepairModal"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"
import { TRANSPORT_PAYMENT_METHOD_LABELS } from "@/modules/transport/application/payment-options"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"
import { cn } from "@/lib/utils"
import {
  TransportSegmentedTabs,
  transportFilterTriggerClass,
} from "@/components/transport/toolbar"

type RepairRow = {
  id: string
  symptom: string
  notes: string | null
  status: RepairStatus
  reportedAt: string
  startedAt: string | null
  closedAt: string | null
  repairCost: string | number | null
  paymentMethod: "cash" | "credit" | null
  vehicle: {
    id: string
    plateNumber: string
    name: string
    vehicleType: string
    currentStatus: string
  }
  branch: { id: string; name: string }
  reportedBy?: { firstName: string; lastName: string } | null
}

type StatusFilter = RepairStatus

type VehicleOption = {
  id: string
  plateNumber: string
  name: string
}

type ListMeta = {
  total: number
  take: number
  truncated: boolean
}

type OpenCounts = {
  reported: number
  in_repair: number
  inspection: number
}

const NEEDS_DATE_DEFAULT = new Set<StatusFilter>(["closed", "cancelled"])

function formatBangkokYmd(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

function lastNDaysRange(days: number): { from: string; to: string } {
  const to = formatBangkokYmd()
  const n = Math.max(1, days)
  const anchor = new Date(`${to}T12:00:00+07:00`)
  const fromDate = new Date(anchor.getTime() - (n - 1) * 24 * 60 * 60 * 1000)
  return { from: formatBangkokYmd(fromDate), to }
}

function formatDt(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })
}

function formatYmdShort(ymd: string) {
  const [y, m, d] = ymd.split("-")
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y.slice(2)}`
}

function formatCostDisplay(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—"
  const n = typeof value === "number" ? value : Number(value)
  if (Number.isNaN(n)) return "—"
  return n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function RepairsPageClient() {
  const t = useTranslations("transport")
  const [items, setItems] = useState<RepairRow[]>([])
  const [meta, setMeta] = useState<ListMeta | null>(null)
  const [openCounts, setOpenCounts] = useState<OpenCounts>({
    reported: 0,
    in_repair: 0,
    inspection: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilter>("reported")

  const defaultRange = useMemo(() => lastNDaysRange(30), [])
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [vehicleFilter, setVehicleFilter] = useState("")
  /** draft values inside popup before Apply */
  const [draftFrom, setDraftFrom] = useState("")
  const [draftTo, setDraftTo] = useState("")
  const [draftVehicle, setDraftVehicle] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)

  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [reportOpen, setReportOpen] = useState(false)
  const [editingRepair, setEditingRepair] = useState<RepairRow | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const effectiveFrom = NEEDS_DATE_DEFAULT.has(filter) ? fromDate || defaultRange.from : fromDate
  const effectiveTo = NEEDS_DATE_DEFAULT.has(filter) ? toDate || defaultRange.to : toDate

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      qs.set("status", filter)
      if (vehicleFilter) qs.set("vehicleId", vehicleFilter)
      if (effectiveFrom) qs.set("from", effectiveFrom)
      if (effectiveTo) qs.set("to", effectiveTo)

      const json = await fetchJson<{
        data?: RepairRow[]
        meta?: ListMeta | null
        openCounts?: OpenCounts | null
      }>(`/api/transport/repairs?${qs.toString()}`)
      setItems(json.data ?? [])
      setMeta(json.meta ?? null)
      if (json.openCounts) {
        setOpenCounts({
          reported: json.openCounts.reported ?? 0,
          in_repair: json.openCounts.in_repair ?? 0,
          inspection: json.openCounts.inspection ?? 0,
        })
      }
    } catch (err) {
      setItems([])
      setMeta(null)
      setError(err instanceof ClientFetchError ? err.message : t("loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [filter, vehicleFilter, effectiveFrom, effectiveTo, t])

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

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadVehicles()
  }, [loadVehicles])

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

  const openFilterPopup = () => {
    setDraftFrom(effectiveFrom)
    setDraftTo(effectiveTo)
    setDraftVehicle(vehicleFilter)
    setFilterOpen((o) => !o)
  }

  const applyFilters = () => {
    if (draftFrom && draftTo && draftFrom > draftTo) {
      setActionError("วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด")
      return
    }
    setActionError(null)
    setFromDate(draftFrom)
    setToDate(draftTo)
    setVehicleFilter(draftVehicle)
    setFilterOpen(false)
  }

  const clearFilters = () => {
    if (NEEDS_DATE_DEFAULT.has(filter)) {
      setDraftFrom(defaultRange.from)
      setDraftTo(defaultRange.to)
      setFromDate(defaultRange.from)
      setToDate(defaultRange.to)
    } else {
      setDraftFrom("")
      setDraftTo("")
      setFromDate("")
      setToDate("")
    }
    setDraftVehicle("")
    setVehicleFilter("")
    setFilterOpen(false)
  }

  const changeStatus = (next: StatusFilter) => {
    setFilter(next)
    if (NEEDS_DATE_DEFAULT.has(next) && !fromDate && !toDate) {
      setFromDate(defaultRange.from)
      setToDate(defaultRange.to)
    }
    if (!NEEDS_DATE_DEFAULT.has(next)) {
      // keep dates if user set them; optional clear not required
    }
  }

  const runAction = async (id: string, action: "start" | "inspect" | "close" | "cancel") => {
    setActionId(id)
    setActionError(null)
    try {
      const res = await fetch(`/api/transport/repairs/${id}/${action}`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) {
        setActionError(json.error ?? "ดำเนินการไม่สำเร็จ")
        return
      }
      await load()
    } catch {
      setActionError("เกิดข้อผิดพลาดในการเชื่อมต่อ")
    } finally {
      setActionId(null)
    }
  }

  const selectedVehicle = vehicles.find((v) => v.id === vehicleFilter)

  const filterSummary = (() => {
    const parts: string[] = []
    if (effectiveFrom && effectiveTo) {
      parts.push(`${formatYmdShort(effectiveFrom)}–${formatYmdShort(effectiveTo)}`)
    } else if (effectiveFrom) {
      parts.push(`ตั้งแต่ ${formatYmdShort(effectiveFrom)}`)
    } else if (effectiveTo) {
      parts.push(`ถึง ${formatYmdShort(effectiveTo)}`)
    } else {
      parts.push("ไม่จำกัดวัน")
    }
    parts.push(selectedVehicle ? selectedVehicle.plateNumber : "ทุกคัน")
    return parts.join(" · ")
  })()

  const FILTERS: { key: StatusFilter; label: string; count?: number }[] = [
    { key: "reported", label: "แจ้งซ่อม", count: openCounts.reported },
    { key: "in_repair", label: "กำลังซ่อม", count: openCounts.in_repair },
    { key: "inspection", label: "ตรวจสอบ", count: openCounts.inspection },
    { key: "closed", label: "ปิดงาน" },
    { key: "cancelled", label: "ยกเลิก" },
  ]

  return (
    <div className="min-w-0 space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <TransportSegmentedTabs
          activeKey={filter}
          onChange={(key) => changeStatus(key as typeof filter)}
          items={FILTERS.map((f) => ({
            key: f.key,
            label: f.label,
            count: typeof f.count === "number" ? f.count : undefined,
          }))}
        />

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
                {NEEDS_DATE_DEFAULT.has(filter) && (
                  <p className="text-[11px] text-muted-foreground">
                    แท็บนี้แนะนำจำกัดช่วงเวลา (ค่าเริ่มต้น 30 วันล่าสุด)
                  </p>
                )}
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

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            title={t("refresh")}
            aria-label={t("refresh")}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
          <GlassButton onClick={() => setReportOpen(true)} icon={<Plus className="h-4 w-4" />}>
            {t("repairsReport")}
          </GlassButton>
        </div>
      </div>

      <p className="text-xs text-muted-foreground sm:hidden">{filterSummary}</p>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>
      )}
      {meta?.truncated && !error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          แสดง {items.length} จากทั้งหมด {meta.total} รายการ — จำกัดช่วงเวลาหรือกรองรถเพื่อดูครบ
        </div>
      )}

      {loading ? (
        <LoadingState title={t("repairsLoading")} />
      ) : error ? (
        <ErrorState title={t("loadFailed")} description={error} onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <GlassCard className="p-8 text-center text-sm text-muted-foreground">
          {t("repairsEmpty")}
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {items.map((item) => {
            const plate = item.vehicle.plateNumber
            const vehicleName =
              item.vehicle.name &&
              item.vehicle.name.trim() !== plate.trim()
                ? item.vehicle.name
                : null
            const paymentLabel = item.paymentMethod
              ? TRANSPORT_PAYMENT_METHOD_LABELS[item.paymentMethod]
              : null

            return (
            <GlassCard
              key={item.id}
              padding="none"
              className="flex h-full flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
                <RepairStatusBadge status={item.status} />
                {(item.status === "closed" || item.status === "cancelled") && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Wrench className="h-3 w-3 shrink-0" />
                    {item.status === "closed" ? formatDt(item.closedAt) : "ยกเลิกแล้ว"}
                  </span>
                )}
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3">
                <dl className="space-y-1 text-sm">
                  <div className="flex items-baseline gap-2">
                    <dt className="w-14 shrink-0 text-[11px] font-medium text-muted-foreground">ทะเบียน</dt>
                    <dd className="min-w-0">
                      <p className="font-mono text-sm font-bold tracking-wide text-foreground">{plate}</p>
                      {vehicleName ? (
                        <p className="truncate text-xs text-muted-foreground">{vehicleName}</p>
                      ) : null}
                    </dd>
                  </div>
                  <div className="flex items-start gap-2">
                    <dt className="w-14 shrink-0 pt-0.5 text-[11px] font-medium text-muted-foreground">อาการ</dt>
                    <dd
                      className="h-[2.75rem] min-w-0 line-clamp-2 text-sm leading-snug text-foreground"
                      title={item.symptom}
                    >
                      {item.symptom}
                    </dd>
                  </div>
                  <div className="flex items-start gap-2">
                    <dt className="w-14 shrink-0 pt-0.5 text-[11px] font-medium text-muted-foreground">หมายเหตุ</dt>
                    <dd
                      className={cn(
                        "h-[2.75rem] min-w-0 line-clamp-2 text-sm leading-snug",
                        item.notes?.trim() ? "text-foreground" : "text-muted-foreground"
                      )}
                      title={item.notes ?? undefined}
                    >
                      {item.notes?.trim() ? item.notes : "—"}
                    </dd>
                  </div>
                </dl>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border bg-muted/30 px-2.5 py-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground">ค่าใช้จ่าย</p>
                    <p className="text-sm font-semibold text-foreground">
                      {formatCostDisplay(item.repairCost)} บาท
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 px-2.5 py-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground">วิธีจ่าย</p>
                    {paymentLabel ? (
                      <span
                        className={cn(
                          "mt-0.5 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                          item.paymentMethod === "cash"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-violet-100 text-violet-800"
                        )}
                      >
                        {paymentLabel}
                      </span>
                    ) : (
                      <p className="text-sm font-medium text-muted-foreground">ไม่ระบุ</p>
                    )}
                  </div>
                </div>

                <dl className="mt-auto space-y-1.5 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="shrink-0 text-muted-foreground">สาขา</dt>
                    <dd className="text-right font-medium text-foreground">{item.branch.name}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="shrink-0 text-muted-foreground">แจ้งเมื่อ</dt>
                    <dd className="text-right font-medium text-foreground">{formatDt(item.reportedAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="shrink-0 text-muted-foreground">ผู้แจ้ง</dt>
                    <dd className="text-right font-medium text-foreground">
                      {item.reportedBy
                        ? `${item.reportedBy.firstName} ${item.reportedBy.lastName}`
                        : "—"}
                    </dd>
                  </div>
                  {item.startedAt && (
                    <div className="flex justify-between gap-2">
                      <dt className="shrink-0 text-muted-foreground">เข้าซ่อม</dt>
                      <dd className="text-right font-medium text-foreground">{formatDt(item.startedAt)}</dd>
                    </div>
                  )}
                  {item.closedAt && item.status === "closed" && (
                    <div className="flex justify-between gap-2">
                      <dt className="shrink-0 text-muted-foreground">ปิดงาน</dt>
                      <dd className="text-right font-medium text-foreground">{formatDt(item.closedAt)}</dd>
                    </div>
                  )}
                </dl>

                <div className="flex flex-wrap gap-1.5 border-t border-border pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingRepair(item)}
                    disabled={actionId === item.id}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    แก้ไข
                  </button>
                  {item.status === "reported" && (
                    <>
                      <GlassButton
                        size="sm"
                        onClick={() => runAction(item.id, "start")}
                        disabled={actionId === item.id}
                        icon={
                          actionId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )
                        }
                      >
                        เข้าซ่อม
                      </GlassButton>
                      <button
                        type="button"
                        onClick={() => runAction(item.id, "cancel")}
                        disabled={actionId === item.id}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        ยกเลิก
                      </button>
                    </>
                  )}
                  {item.status === "in_repair" && (
                    <GlassButton
                      size="sm"
                      onClick={() => runAction(item.id, "inspect")}
                      disabled={actionId === item.id}
                      icon={
                        actionId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ClipboardCheck className="h-3.5 w-3.5" />
                        )
                      }
                    >
                      ส่งตรวจสอบ
                    </GlassButton>
                  )}
                  {item.status === "inspection" && (
                    <GlassButton
                      size="sm"
                      onClick={() => runAction(item.id, "close")}
                      disabled={
                        actionId === item.id ||
                        item.repairCost == null ||
                        item.repairCost === ""
                      }
                      title={
                        item.repairCost == null || item.repairCost === ""
                          ? "กรุณาระบุค่าใช้จ่ายก่อนปิดงาน"
                          : undefined
                      }
                      icon={
                        actionId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )
                      }
                    >
                      ปิดงาน
                    </GlassButton>
                  )}
                </div>
              </div>
            </GlassCard>
            )
          })}
        </div>
      )}

      <ReportRepairModal
        open={reportOpen}
        onSuccess={() => {
          setReportOpen(false)
          if (filter === "reported") {
            load()
          } else {
            setFilter("reported")
          }
        }}
        onCancel={() => setReportOpen(false)}
      />

      <EditRepairModal
        open={!!editingRepair}
        repair={editingRepair}
        onSuccess={() => {
          setEditingRepair(null)
          load()
        }}
        onCancel={() => setEditingRepair(null)}
      />
    </div>
  )
}
