"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"
import { CustomerPicker } from "@/components/transport/CustomerPicker"
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

const emptyStop = (): StopForm => ({
  sequence: 1,
  customerId: "",
  customerName: "",
  address: "",
  contactName: "",
  contactPhone: "",
  weightKg: "",
})

export default function NewTransportJobPage() {
  const router = useRouter()
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

  const addStop = () => {
    setStops((prev) => [
      ...prev,
      { ...emptyStop(), sequence: prev.length + 1 },
    ])
  }

  const removeStop = (idx: number) => {
    setStops((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sequence: i + 1 })))
  }

  const updateStop = (idx: number, field: keyof StopForm, value: string) => {
    setStops((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)))
  }

  const handleHeaderCustomer = (customerId: string, customer: { name: string } | null) => {
    setForm((f) => ({
      ...f,
      customerId,
      customerName: customer?.name ?? "",
    }))
  }

  const handleStopCustomer = (
    idx: number,
    customerId: string,
    customer: { name: string; address: string | null; contactName: string | null; phone: string | null } | null
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
      router.push(`/transport/jobs/${json.data.id}`)
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ")
    } finally {
      setSaving(false)
    }
  }

  const selectClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">สร้างใบงานขนส่งใหม่</h1>
        <p className="text-sm text-slate-500">กรอกข้อมูลงานขนส่งและจุดแวะ</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">ข้อมูลใบงาน</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">สาขา *</label>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">ชื่อลูกค้า</label>
              <CustomerPicker value={form.customerId} onChange={handleHeaderCustomer} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">ประเภทงาน *</label>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">ประเภทสินค้า</label>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">วันที่นัดวิ่งงาน</label>
              <input
                type="date"
                value={form.scheduledDate}
                onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">ความสำคัญ</label>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">หมายเหตุ</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">มอบหมายรถ (บังคับ)</h2>
          <p className="text-xs text-slate-500">
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

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">จุดแวะ (Stops)</h2>
            <button
              type="button"
              onClick={addStop}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-600 hover:text-cyan-700"
            >
              <Plus className="h-4 w-4" /> เพิ่มจุดแวะ
            </button>
          </div>

          {stops.map((stop, idx) => (
            <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Stop {stop.sequence}</span>
                {stops.length > 1 && (
                  <button type="button" onClick={() => removeStop(idx)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">เลือกจาก Master</label>
                <CustomerPicker
                  value={stop.customerId}
                  onChange={(customerId, customer) => handleStopCustomer(idx, customerId, customer)}
                  placeholder="— เลือกลูกค้า/ปลายทาง —"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">ชื่อลูกค้า / ปลายทาง *</label>
                  <input
                    required
                    value={stop.customerName}
                    onChange={(e) => updateStop(idx, "customerName", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">ที่อยู่ *</label>
                  <input
                    required
                    value={stop.address}
                    onChange={(e) => updateStop(idx, "address", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">ชื่อผู้ติดต่อ</label>
                  <input
                    value={stop.contactName}
                    onChange={(e) => updateStop(idx, "contactName", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">เบอร์โทร</label>
                  <input
                    value={stop.contactPhone}
                    onChange={(e) => updateStop(idx, "contactPhone", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">น้ำหนัก (กก.)</label>
                  <input
                    type="number"
                    min="0"
                    value={stop.weightKg}
                    onChange={(e) => updateStop(idx, "weightKg", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </section>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
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
