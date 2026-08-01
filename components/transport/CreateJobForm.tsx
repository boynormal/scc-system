"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, Trash2 } from "lucide-react"
import {
  CustomerPicker,
  type TmsCustomerOption,
} from "@/components/transport/CustomerPicker"
import { JobAssignmentPickers } from "@/components/transport/JobAssignmentPickers"

type Branch = { id: string; name: string; code: string }
type LookupOption = { id: string; name: string }

type StopForm = {
  sequence: number
  customerId: string
  customerName: string
  address: string
  contactName: string
  contactPhone: string
  weightKg: string
}

type PrefillSnap = {
  customerId: string
  customerName: string
  address: string
  contactName: string
  contactPhone: string
}

const emptyStop = (): StopForm => ({
  sequence: 1,
  customerId: "",
  customerName: "",
  address: "",
  contactName: "",
  contactPhone: "",
  weightKg: "",
})

function stopDestinationFields(s: StopForm): Omit<PrefillSnap, "customerId"> & { customerId: string } {
  return {
    customerId: s.customerId,
    customerName: s.customerName,
    address: s.address,
    contactName: s.contactName,
    contactPhone: s.contactPhone,
  }
}

function isDestinationEmpty(s: StopForm) {
  return !s.customerId && !s.customerName && !s.address && !s.contactName && !s.contactPhone
}

function matchesPrefillSnap(s: StopForm, snap: PrefillSnap | null) {
  if (!snap) return false
  const cur = stopDestinationFields(s)
  return (
    cur.customerId === snap.customerId &&
    cur.customerName === snap.customerName &&
    cur.address === snap.address &&
    cur.contactName === snap.contactName &&
    cur.contactPhone === snap.contactPhone
  )
}

function resequence(stops: StopForm[]) {
  return stops.map((s, i) => ({ ...s, sequence: i + 1 }))
}

type Props = {
  onCancel: () => void
  onSuccess: (jobId: string) => void
  /** Compact sections for modal layout */
  compact?: boolean
}

export function CreateJobForm({ onCancel, onSuccess, compact = false }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [jobTypes, setJobTypes] = useState<LookupOption[]>([])
  const [cargoTypes, setCargoTypes] = useState<LookupOption[]>([])

  const [form, setForm] = useState({
    branchId: "",
    customerId: "",
    customerName: "",
    jobType: "",
    cargoType: "",
    priority: "normal" as const,
    scheduledDate: "",
    notes: "",
  })

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/branches").then((r) => r.json()),
      fetch("/api/transport/master-data/job-types?activeOnly=1").then((r) => r.json()),
      fetch("/api/transport/master-data/cargo-types?activeOnly=1").then((r) => r.json()),
    ])
      .then(([branchesJson, jobTypesJson, cargoTypesJson]) => {
        const list: Branch[] = branchesJson.data ?? []
        setBranches(list)
        setJobTypes(jobTypesJson.data ?? [])
        setCargoTypes(cargoTypesJson.data ?? [])
        if (list.length === 1) {
          setForm((f) => ({ ...f, branchId: list[0].id }))
        }
      })
      .catch(() => {})
  }, [])

  const [stops, setStops] = useState<StopForm[]>([emptyStop()])
  const [vehicleId, setVehicleId] = useState("")
  const [driverId, setDriverId] = useState("")
  const destinationPrefillRef = useRef<PrefillSnap | null>(null)

  /** Insert a waypoint before the final destination stop. */
  const addStop = () => {
    setStops((prev) => {
      if (prev.length === 0) return [emptyStop()]
      const last = prev[prev.length - 1]
      const before = prev.slice(0, -1)
      return resequence([...before, emptyStop(), last])
    })
  }

  const removeStop = (idx: number) => {
    setStops((prev) => resequence(prev.filter((_, i) => i !== idx)))
  }

  const updateStop = (idx: number, field: keyof StopForm, value: string) => {
    setStops((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)))
  }

  const handleHeaderCustomer = (customerId: string, customer: TmsCustomerOption | null) => {
    setForm((f) => ({
      ...f,
      customerId,
      customerName: customer?.name ?? "",
    }))

    // Clearing header customer: keep last stop as-is.
    if (!customerId || !customer) return

    const nextSnap: PrefillSnap = {
      customerId,
      customerName: customer.name,
      address: customer.address ?? "",
      contactName: customer.contactName ?? "",
      contactPhone: customer.phone ?? "",
    }

    setStops((prev) => {
      if (prev.length === 0) return prev
      const lastIdx = prev.length - 1
      const last = prev[lastIdx]
      const canPrefill =
        isDestinationEmpty(last) || matchesPrefillSnap(last, destinationPrefillRef.current)
      if (!canPrefill) return prev

      destinationPrefillRef.current = nextSnap
      return prev.map((s, i) =>
        i === lastIdx
          ? {
              ...s,
              customerId: nextSnap.customerId,
              customerName: nextSnap.customerName,
              address: nextSnap.address,
              contactName: nextSnap.contactName,
              contactPhone: nextSnap.contactPhone,
            }
          : s
      )
    })
  }

  const handleStopCustomer = (
    idx: number,
    customerId: string,
    customer: TmsCustomerOption | null
  ) => {
    setStops((prev) =>
      prev.map((s, i) =>
        i === idx
          ? {
              ...s,
              customerId,
              customerName: customer?.name ?? s.customerName,
              address: customer?.address ?? s.address,
              contactName: customer?.contactName ?? s.contactName,
              contactPhone: customer?.phone ?? s.contactPhone,
            }
          : s
      )
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (stops.some((s) => !s.customerName || !s.address)) {
      setError("กรุณากรอกชื่อและที่อยู่ทุก Stop")
      return
    }
    if (!vehicleId) {
      setError("กรุณาเลือกรถ")
      return
    }
    if (!driverId) {
      setError("กรุณาเลือกคนขับ")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/transport/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: form.branchId,
          customerId: form.customerId || undefined,
          customerName: form.customerName || undefined,
          jobType: form.jobType,
          cargoType: form.cargoType || undefined,
          priority: form.priority,
          scheduledDate: form.scheduledDate ? new Date(form.scheduledDate).toISOString() : undefined,
          notes: form.notes || undefined,
          vehicleId,
          driverId,
          stops: stops.map((s) => ({
            sequence: s.sequence,
            customerName: s.customerName,
            address: s.address,
            contactName: s.contactName || undefined,
            contactPhone: s.contactPhone || undefined,
            weightKg: s.weightKg ? Number(s.weightKg) : undefined,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "เกิดข้อผิดพลาด")
        return
      }
      onSuccess(json.data.id as string)
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ")
    } finally {
      setSaving(false)
    }
  }

  const selectClass =
    "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-card"
  const sectionClass = compact
    ? "space-y-3 rounded-lg border border-border bg-muted/40 p-4"
    : "space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm"

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-foreground">ข้อมูลใบงาน</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">สาขา *</label>
              <select
                required
                value={form.branchId}
                onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
                className={selectClass}
              >
                <option value="">-- เลือกสาขา --</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.code ? ` (${b.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">ชื่อลูกค้า</label>
              <CustomerPicker value={form.customerId} onChange={handleHeaderCustomer} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">ประเภทงาน *</label>
              <select
                required
                value={form.jobType}
                onChange={(e) => setForm((f) => ({ ...f, jobType: e.target.value }))}
                className={selectClass}
              >
                <option value="">-- เลือกประเภทงาน --</option>
                {jobTypes.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">ประเภทสินค้า</label>
              <select
                value={form.cargoType}
                onChange={(e) => setForm((f) => ({ ...f, cargoType: e.target.value }))}
                className={selectClass}
              >
                <option value="">-- เลือกประเภทสินค้า --</option>
                {cargoTypes.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">วันที่นัดวิ่งงาน</label>
              <input
                type="date"
                value={form.scheduledDate}
                onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">ความสำคัญ</label>
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as typeof form.priority }))}
                className={selectClass}
              >
                <option value="low">ต่ำ</option>
                <option value="normal">ปกติ</option>
                <option value="high">สูง</option>
                <option value="urgent">ด่วน</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">หมายเหตุ</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-foreground">มอบหมายรถ (บังคับ)</h2>
          <p className="text-xs text-muted-foreground">
            เลือกรถและคนขับจากทุกสาขาได้ — ใช้งานร่วมกันทั้งองค์กร
          </p>
          <JobAssignmentPickers
            branchId={form.branchId}
            vehicleId={vehicleId}
            driverId={driverId}
            onVehicleChange={setVehicleId}
            onDriverChange={setDriverId}
            vehiclesScope="all"
            driversScope="all"
            vehicleRequired
            driverRequired
            vehicleLabel="รถ"
            driverLabel="คนขับ"
          />
        </section>

        <section className={sectionClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">จุดแวะ (Stops)</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                ลูกค้าหัวใบงานจะเติมจุดหมายสุดท้ายให้อัตโนมัติ — จุดที่เพิ่มเป็นจุดแวะระหว่างทาง
              </p>
            </div>
            <button
              type="button"
              onClick={addStop}
              className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-cyan-600 hover:text-cyan-700"
            >
              <Plus className="h-4 w-4" /> เพิ่มจุดแวะ
            </button>
          </div>

          {stops.map((stop, idx) => {
            const isLast = idx === stops.length - 1
            return (
              <div key={idx} className="space-y-3 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Stop {stop.sequence}
                    {" · "}
                    {isLast ? "จุดหมายสุดท้าย" : "จุดแวะระหว่างทาง"}
                  </span>
                  {stops.length > 1 && (
                    <button type="button" onClick={() => removeStop(idx)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">เลือกจาก Master</label>
                  <CustomerPicker
                    value={stop.customerId}
                    onChange={(customerId, customer) => handleStopCustomer(idx, customerId, customer)}
                    placeholder="— เลือกลูกค้า/ปลายทาง —"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">ชื่อลูกค้า / ปลายทาง *</label>
                    <input
                      required
                      value={stop.customerName}
                      onChange={(e) => updateStop(idx, "customerName", e.target.value)}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">ที่อยู่ *</label>
                    <input
                      required
                      value={stop.address}
                      onChange={(e) => updateStop(idx, "address", e.target.value)}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">ชื่อผู้ติดต่อ</label>
                    <input
                      value={stop.contactName}
                      onChange={(e) => updateStop(idx, "contactName", e.target.value)}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">เบอร์โทร</label>
                    <input
                      value={stop.contactPhone}
                      onChange={(e) => updateStop(idx, "contactPhone", e.target.value)}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">น้ำหนัก (กก.)</label>
                    <input
                      type="number"
                      min="0"
                      value={stop.weightKg}
                      onChange={(e) => updateStop(idx, "weightKg", e.target.value)}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </section>

        <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-card/95 py-2 backdrop-blur-sm">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/60"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก..." : "สร้างใบงาน"}
          </button>
        </div>
      </form>
    </div>
  )
}
