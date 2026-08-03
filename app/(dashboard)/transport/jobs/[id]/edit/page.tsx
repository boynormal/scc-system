"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import {
  CustomerPicker,
  type TmsCustomerOption,
} from "@/components/transport/CustomerPicker"
import { JobStatusBadge } from "@/components/transport/job-status-badge"
import { AssignJobForm } from "@/components/transport/assign-job-form"
import {
  JobStopsEditor,
  applyHeaderCustomerToStops,
  emptyJobStop,
  type DestinationPrefillSnap,
  type JobStopForm,
} from "@/components/transport/JobStopsEditor"
import type { TransportJobStatus } from "@prisma/client"

type LookupOption = { id: string; name: string }

type JobForm = {
  jobNumber: string
  customerId: string
  customerName: string
  jobType: string
  cargoType: string
  priority: string
  scheduledDate: string
  status: TransportJobStatus
  notes: string
}

type CurrentAssignment = {
  vehicle: { id: string; plateNumber: string; name: string; vehicleType: string }
  driver: { id: string; firstName: string; lastName: string; phone: string | null }
  assignedByUser: { firstName: string; lastName: string }
  assignedAt: string
} | null

function mapAssignment(raw: {
  vehicle?: { id: string; plateNumber: string; name: string; vehicleType: string }
  driver?: { id: string; firstName: string; lastName: string; phone?: string | null }
  assignedByUser?: { firstName: string; lastName: string }
  assignedAt?: string | Date | null
} | null | undefined): CurrentAssignment {
  if (!raw?.vehicle || !raw?.driver || !raw?.assignedByUser) return null
  return {
    vehicle: {
      id: raw.vehicle.id,
      plateNumber: raw.vehicle.plateNumber,
      name: raw.vehicle.name,
      vehicleType: raw.vehicle.vehicleType,
    },
    driver: {
      id: raw.driver.id,
      firstName: raw.driver.firstName,
      lastName: raw.driver.lastName,
      phone: raw.driver.phone ?? null,
    },
    assignedByUser: {
      firstName: raw.assignedByUser.firstName,
      lastName: raw.assignedByUser.lastName,
    },
    assignedAt:
      typeof raw.assignedAt === "string"
        ? raw.assignedAt
        : raw.assignedAt
          ? new Date(raw.assignedAt).toISOString()
          : "",
  }
}

export default function EditTransportJobPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const jobId = params.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<JobForm | null>(null)
  const [branchId, setBranchId] = useState<string | null>(null)
  const [assignment, setAssignment] = useState<CurrentAssignment>(null)
  const [stops, setStops] = useState<JobStopForm[]>([emptyJobStop()])
  const [jobTypes, setJobTypes] = useState<LookupOption[]>([])
  const [cargoTypes, setCargoTypes] = useState<LookupOption[]>([])
  const destinationPrefillRef = useRef<DestinationPrefillSnap | null>(null)

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
        scheduledDate: j.scheduledDate ? String(j.scheduledDate).substring(0, 10) : "",
        status: j.status,
        notes: j.notes ?? "",
      })
      setBranchId(j.branchId ?? null)
      setAssignment(mapAssignment(j.assignment))

      const loadedStops: JobStopForm[] = (j.stops ?? []).map(
        (
          s: {
            id: string
            sequence: number
            customerName: string
            address: string
            contactName: string | null
            contactPhone: string | null
            weightKg: string | number | null
          },
          idx: number
        ) => ({
          id: s.id,
          sequence: s.sequence ?? idx + 1,
          customerId: "",
          customerName: s.customerName ?? "",
          address: s.address ?? "",
          contactName: s.contactName ?? "",
          contactPhone: s.contactPhone ?? "",
          weightKg: s.weightKg != null ? String(s.weightKg) : "",
        })
      )
      setStops(loadedStops.length > 0 ? loadedStops : [emptyJobStop()])
    } catch {
      setError("เกิดข้อผิดพลาดในการโหลดข้อมูล")
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    fetchJob()
  }, [fetchJob])

  const readOnly =
    form?.status === "completed" || form?.status === "cancelled"

  const handleHeaderCustomer = (customerId: string, customer: TmsCustomerOption | null) => {
    setForm((f) =>
      f
        ? {
            ...f,
            customerId,
            customerName: customer?.name ?? "",
          }
        : f
    )
    if (!customerId || !customer || readOnly) return
    setStops((prev) =>
      applyHeaderCustomerToStops(prev, destinationPrefillRef, customerId, customer)
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form || readOnly) return
    if (stops.some((s) => !s.customerName || !s.address)) {
      setError("กรุณากรอกชื่อและที่อยู่ทุก Stop")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const headerRes = await fetch(`/api/transport/jobs/${jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: form.customerId || null,
          customerName: form.customerName || undefined,
          jobType: form.jobType,
          cargoType: form.cargoType || undefined,
          priority: form.priority,
          scheduledDate: form.scheduledDate ? new Date(form.scheduledDate).toISOString() : null,
          notes: form.notes || undefined,
        }),
      })
      const headerJson = await headerRes.json()
      if (!headerRes.ok) {
        setError(headerJson.error ?? "เกิดข้อผิดพลาดในการบันทึกใบงาน")
        return
      }

      const stopsRes = await fetch(`/api/transport/jobs/${jobId}/stops`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stops: stops.map((s) => ({
            id: s.id,
            customerName: s.customerName,
            address: s.address,
            contactName: s.contactName || null,
            contactPhone: s.contactPhone || null,
            weightKg: s.weightKg ? Number(s.weightKg) : null,
          })),
        }),
      })
      const stopsJson = await stopsRes.json()
      if (!stopsRes.ok) {
        setError(stopsJson.error ?? "บันทึกหัวใบงานแล้ว แต่จุดแวะล้มเหลว")
        return
      }

      router.push("/transport/jobs")
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ")
    } finally {
      setSaving(false)
    }
  }

  const selectClass =
    "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-card disabled:opacity-60"

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

  if (loading) return <div className="p-6 text-muted-foreground">กำลังโหลด...</div>
  if (!form) return <div className="p-6 text-red-500">{error ?? "ไม่พบข้อมูล"}</div>

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <Link
          href="/transport/jobs"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> กลับ
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">แก้ไขใบงาน {form.jobNumber}</h1>
          <JobStatusBadge status={form.status} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          เปลี่ยนสถานะใบงานได้ที่หน้ารายละเอียด
        </p>
      </div>

      {readOnly && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          ใบงานนี้{form.status === "completed" ? "เสร็จสิ้น" : "ถูกยกเลิก"}แล้ว ไม่สามารถแก้ไขได้
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">ข้อมูลใบงาน</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">ชื่อลูกค้า</label>
              <CustomerPicker
                value={form.customerId}
                onChange={handleHeaderCustomer}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">ประเภทงาน *</label>
              <select
                required
                disabled={readOnly}
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
              <label className="mb-1 block text-xs font-medium text-muted-foreground">ประเภทสินค้า</label>
              <select
                disabled={readOnly}
                value={form.cargoType}
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
              <label className="mb-1 block text-xs font-medium text-muted-foreground">วันที่นัดวิ่งงาน</label>
              <input
                type="date"
                disabled={readOnly}
                value={form.scheduledDate}
                onChange={(e) => setForm((f) => f && { ...f, scheduledDate: e.target.value })}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">ความสำคัญ</label>
              <select
                disabled={readOnly}
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
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">หมายเหตุ</label>
              <textarea
                disabled={readOnly}
                value={form.notes}
                onChange={(e) => setForm((f) => f && { ...f, notes: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-60"
              />
            </div>
          </div>
        </div>
      </form>

      {branchId && (
        <AssignJobForm
          jobId={jobId}
          branchId={branchId}
          jobStatus={form.status}
          currentAssignment={assignment}
          onAssignmentChange={fetchJob}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <JobStopsEditor stops={stops} onChange={setStops} disabled={readOnly} />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/transport/jobs")}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/60"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving || readOnly}
            className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </form>
    </div>
  )
}
