"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { CustomerPicker } from "@/components/transport/CustomerPicker"

type LookupOption = { id: string; name: string }

type JobData = {
  jobNumber: string
  customerId: string
  customerName: string | null
  jobType: string
  cargoType: string | null
  priority: string
  scheduledDate: string | null
  status: string
  notes: string | null
}

const STATUS_OPTIONS = [
  { value: "pending_assignment", label: "รอมอบหมาย" },
  { value: "assigned", label: "มอบหมายแล้ว" },
  { value: "driver_accepted", label: "คนขับรับงาน" },
  { value: "en_route", label: "กำลังเดินทาง" },
  { value: "at_pickup", label: "ถึงจุดรับ" },
  { value: "loading", label: "กำลังโหลด" },
  { value: "departed", label: "ออกเดินทาง" },
  { value: "at_destination", label: "ถึงปลายทาง" },
  { value: "unloading", label: "กำลังขนถ่าย" },
  { value: "completed", label: "เสร็จสิ้น" },
  { value: "cancelled", label: "ยกเลิก" },
]

export default function EditTransportJobPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const jobId = params.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<JobData | null>(null)
  const [jobTypes, setJobTypes] = useState<LookupOption[]>([])
  const [cargoTypes, setCargoTypes] = useState<LookupOption[]>([])

  useEffect(() => {
    Promise.all([
      fetch("/api/transport/master-data/job-types?activeOnly=1").then((r) => r.json()),
      fetch("/api/transport/master-data/cargo-types?activeOnly=1").then((r) => r.json()),
    ]).then(([jobTypesJson, cargoTypesJson]) => {
      setJobTypes(jobTypesJson.data ?? [])
      setCargoTypes(cargoTypesJson.data ?? [])
    })
  }, [])

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/transport/jobs/${jobId}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "ไม่พบใบงาน")
        return
      }
      const j = json.data
      setForm({
        jobNumber: j.jobNumber,
        customerId: j.customerId ?? "",
        customerName: j.customerName ?? "",
        jobType: j.jobType,
        cargoType: j.cargoType ?? "",
        priority: j.priority,
        scheduledDate: j.scheduledDate ? j.scheduledDate.substring(0, 10) : "",
        status: j.status,
        notes: j.notes ?? "",
      })
    } catch {
      setError("เกิดข้อผิดพลาดในการโหลดข้อมูล")
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    fetchJob()
  }, [fetchJob])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/transport/jobs/${jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: form.customerId || null,
          customerName: form.customerName || undefined,
          jobType: form.jobType,
          cargoType: form.cargoType || undefined,
          priority: form.priority,
          scheduledDate: form.scheduledDate ? new Date(form.scheduledDate).toISOString() : null,
          status: form.status,
          notes: form.notes || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "เกิดข้อผิดพลาด")
        return
      }
      router.push(`/transport/jobs/${jobId}`)
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ")
    } finally {
      setSaving(false)
    }
  }

  const selectClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"

  const jobTypeOptions = [
    ...jobTypes,
    ...(form && !jobTypes.some((t) => t.name === form.jobType) && form.jobType
      ? [{ id: "_legacy", name: form.jobType }]
      : []),
  ]

  const cargoTypeOptions = [
    ...cargoTypes,
    ...(form && form.cargoType && !cargoTypes.some((t) => t.name === form.cargoType)
      ? [{ id: "_legacy", name: form.cargoType }]
      : []),
  ]

  if (loading) return <div className="p-6 text-slate-500">กำลังโหลด...</div>
  if (!form) return <div className="p-6 text-red-500">{error ?? "ไม่พบข้อมูล"}</div>

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">แก้ไขใบงาน {form.jobNumber}</h1>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">ชื่อลูกค้า</label>
              <CustomerPicker
                value={form.customerId}
                onChange={(customerId, customer) =>
                  setForm((f) =>
                    f
                      ? {
                          ...f,
                          customerId,
                          customerName: customer?.name ?? f.customerName,
                        }
                      : f
                  )
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">ประเภทงาน *</label>
              <select
                required
                value={form.jobType}
                onChange={(e) => setForm((f) => f && { ...f, jobType: e.target.value })}
                className={selectClass}
              >
                <option value="">-- เลือกประเภทงาน --</option>
                {jobTypeOptions.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">ประเภทสินค้า</label>
              <select
                value={form.cargoType ?? ""}
                onChange={(e) => setForm((f) => f && { ...f, cargoType: e.target.value })}
                className={selectClass}
              >
                <option value="">-- เลือกประเภทสินค้า --</option>
                {cargoTypeOptions.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">วันที่นัดวิ่งงาน</label>
              <input
                type="date"
                value={form.scheduledDate ?? ""}
                onChange={(e) => setForm((f) => f && { ...f, scheduledDate: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">ความสำคัญ</label>
              <select
                value={form.priority}
                onChange={(e) => setForm((f) => f && { ...f, priority: e.target.value })}
                className={selectClass}
              >
                <option value="low">ต่ำ</option>
                <option value="normal">ปกติ</option>
                <option value="high">สูง</option>
                <option value="urgent">ด่วน</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">สถานะ</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => f && { ...f, status: e.target.value })}
                className={selectClass}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">หมายเหตุ</label>
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => f && { ...f, notes: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
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
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </form>
    </div>
  )
}
