"use client"

import { useEffect } from "react"
import { Printer } from "lucide-react"
import { JobStatusBadge } from "@/components/transport/job-status-badge"
import type { TransportJobStatus } from "@prisma/client"

const PRIORITY_LABEL: Record<string, string> = { low: "ต่ำ", normal: "ปกติ", high: "สูง", urgent: "ด่วน" }

type Stop = {
  sequence: number
  customerName: string
  address: string
  contactName: string | null
  contactPhone: string | null
  weightKg: unknown
}

type JobPrintData = {
  jobNumber: string
  status: TransportJobStatus
  jobType: string
  cargoType: string | null
  priority: string
  customerName: string | null
  customerPhone: string | null
  branchName: string
  scheduledDate: string | null
  notes: string | null
  createdAt: string
  vehiclePlate: string | null
  vehicleName: string | null
  driverName: string | null
  driverPhone: string | null
  stops: Stop[]
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function JobPrintView({ job, autoPrint = false }: { job: JobPrintData; autoPrint?: boolean }) {
  useEffect(() => {
    if (autoPrint) {
      const timer = window.setTimeout(() => window.print(), 300)
      return () => window.clearTimeout(timer)
    }
  }, [autoPrint])

  return (
    <div className="mx-auto max-w-4xl bg-white p-6 md:p-10 print:max-w-none print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
        >
          <Printer className="h-4 w-4" />
          พิมพ์
        </button>
      </div>

      <header className="border-b border-slate-300 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">ใบงานขนส่ง</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{job.jobNumber}</h1>
          </div>
          <JobStatusBadge status={job.status} />
        </div>
        <p className="mt-2 text-sm text-slate-500">พิมพ์เมื่อ {formatDateTime(new Date().toISOString())}</p>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <InfoBlock label="ลูกค้า" value={job.customerName ?? "—"} />
        <InfoBlock label="โทรศัพท์" value={job.customerPhone ?? "—"} />
        <InfoBlock label="สาขา" value={job.branchName} />
        <InfoBlock label="ประเภทงาน" value={job.jobType} />
        <InfoBlock label="ประเภทสินค้า" value={job.cargoType ?? "—"} />
        <InfoBlock label="ความสำคัญ" value={PRIORITY_LABEL[job.priority] ?? job.priority} />
        <InfoBlock label="วันที่นัดวิ่งงาน" value={formatDate(job.scheduledDate)} />
        <InfoBlock label="วันที่สร้าง" value={formatDate(job.createdAt)} />
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">การมอบหมาย</h2>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <InfoBlock label="รถ" value={job.vehiclePlate ? `${job.vehiclePlate} — ${job.vehicleName}` : "—"} />
          <InfoBlock label="คนขับ" value={job.driverName ?? "—"} sub={job.driverPhone ?? undefined} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">จุดแวะ ({job.stops.length} จุด)</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">ปลายทาง</th>
              <th className="py-2 pr-3">ที่อยู่</th>
              <th className="py-2 pr-3">ติดต่อ</th>
              <th className="py-2">น้ำหนัก (กก.)</th>
            </tr>
          </thead>
          <tbody>
            {job.stops.map((stop) => (
              <tr key={stop.sequence} className="border-b border-slate-100 align-top">
                <td className="py-3 pr-3 font-medium">{stop.sequence}</td>
                <td className="py-3 pr-3">{stop.customerName}</td>
                <td className="py-3 pr-3">{stop.address}</td>
                <td className="py-3 pr-3">
                  {stop.contactName ?? "—"}
                  {stop.contactPhone ? <div className="text-xs text-slate-500">{stop.contactPhone}</div> : null}
                </td>
                <td className="py-3">{stop.weightKg ? Number(stop.weightKg).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {job.notes && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">หมายเหตุ</h2>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{job.notes}</p>
        </section>
      )}

      <footer className="mt-10 grid grid-cols-3 gap-8 border-t border-slate-200 pt-6 text-sm text-slate-600">
        <SignatureLine label="ผู้สร้างใบงาน" />
        <SignatureLine label="คนขับรับทราบ" />
        <SignatureLine label="ผู้รับสินค้า" />
      </footer>
    </div>
  )
}

function InfoBlock({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div className="text-center">
      <div className="mb-10 border-b border-slate-300" />
      <p>{label}</p>
      <p className="mt-1 text-xs text-slate-400">วันที่ _______/_______/_______</p>
    </div>
  )
}
