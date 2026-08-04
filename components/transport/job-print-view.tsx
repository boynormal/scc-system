"use client"

import { useEffect } from "react"
import { Printer } from "lucide-react"
import type { TransportJobStatus } from "@prisma/client"

const PRIORITY_LABEL: Record<string, string> = {
  low: "ต่ำ",
  normal: "ปกติ",
  high: "สูง",
  urgent: "ด่วน",
}

const STATUS_LABEL: Record<TransportJobStatus, string> = {
  pending_assignment: "รอมอบหมาย",
  assigned: "มอบหมายแล้ว",
  driver_accepted: "คนขับรับงาน",
  en_route: "กำลังเดินทาง",
  at_pickup: "ถึงจุดรับ",
  loading: "กำลังโหลด",
  departed: "ออกเดินทาง",
  at_destination: "ถึงปลายทาง",
  unloading: "กำลังขนถ่าย",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
}

const PRINT_CSS = `
@media print {
  @page {
    size: 80mm auto;
    margin: 2mm;
  }
  html,
  body {
    background: white !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .job-print-screen-chrome {
    display: none !important;
  }
  .job-print-ticket {
    width: 76mm !important;
    max-width: 76mm !important;
    margin: 0 auto !important;
    padding: 0 !important;
    box-shadow: none !important;
    border: none !important;
  }
}
`

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
    month: "short",
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5 text-[11px] leading-snug">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 flex-1 break-words text-right font-medium text-slate-900">{value}</span>
    </div>
  )
}

export function JobPrintView({ job, autoPrint = false }: { job: JobPrintData; autoPrint?: boolean }) {
  useEffect(() => {
    if (autoPrint) {
      const timer = window.setTimeout(() => window.print(), 300)
      return () => window.clearTimeout(timer)
    }
  }, [autoPrint])

  const notesText = job.notes?.trim() ?? ""
  const vehicleLabel = job.vehiclePlate
    ? `${job.vehiclePlate}${job.vehicleName ? ` — ${job.vehicleName}` : ""}`
    : "—"

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="job-print-screen-chrome flex justify-center px-3 py-4 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
        >
          <Printer className="h-4 w-4" />
          พิมพ์ 80mm
        </button>
      </div>

      <div className="flex justify-center px-3 pb-8 print:px-0 print:pb-0">
        <article className="job-print-ticket w-[80mm] max-w-[80mm] bg-white px-2 py-3 text-slate-900 shadow-sm ring-1 ring-slate-200 print:shadow-none print:ring-0">
          <header className="border-b border-dashed border-slate-400 pb-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">ใบงานขนส่ง</p>
            <h1 className="mt-0.5 text-[15px] font-bold leading-tight tracking-tight">{job.jobNumber}</h1>
            <p className="mt-1 text-[10px] text-slate-600">
              {STATUS_LABEL[job.status] ?? job.status}
              {" · "}
              {PRIORITY_LABEL[job.priority] ?? job.priority}
            </p>
            <p className="mt-0.5 text-[9px] text-slate-500">พิมพ์เมื่อ {formatDateTime(new Date().toISOString())}</p>
          </header>

          <section className="mt-2 space-y-1 border-b border-dashed border-slate-300 pb-2">
            <Row label="ลูกค้า" value={job.customerName ?? "—"} />
            <Row label="โทร" value={job.customerPhone ?? "—"} />
            <Row label="สาขา" value={job.branchName} />
            <Row label="ประเภทงาน" value={job.jobType} />
            <Row label="สินค้า" value={job.cargoType ?? "—"} />
            <Row label="นัดวิ่ง" value={formatDate(job.scheduledDate)} />
            <Row label="สร้างเมื่อ" value={formatDate(job.createdAt)} />
          </section>

          <section className="mt-2 space-y-1 border-b border-dashed border-slate-300 pb-2">
            <p className="text-[10px] font-semibold text-slate-700">มอบหมาย</p>
            <Row label="รถ" value={vehicleLabel} />
            <Row label="คนขับ" value={job.driverName ?? "—"} />
            {job.driverPhone ? <Row label="โทรคนขับ" value={job.driverPhone} /> : null}
          </section>

          <section className="mt-2 border-b border-dashed border-slate-300 pb-2">
            <p className="mb-1.5 text-[10px] font-semibold text-slate-700">
              จุดแวะ ({job.stops.length})
            </p>
            {job.stops.length === 0 ? (
              <p className="text-[11px] text-slate-500">ไม่มีจุดแวะ</p>
            ) : (
              <ol className="space-y-2">
                {job.stops.map((stop) => (
                  <li key={stop.sequence} className="text-[11px] leading-snug">
                    <p className="font-semibold">
                      {stop.sequence}. {stop.customerName}
                    </p>
                    <p className="break-words text-slate-700">{stop.address}</p>
                    <p className="text-[10px] text-slate-500">
                      ติดต่อ: {stop.contactName ?? "—"}
                      {stop.contactPhone ? ` · ${stop.contactPhone}` : ""}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      น้ำหนัก:{" "}
                      {stop.weightKg != null && stop.weightKg !== ""
                        ? `${Number(stop.weightKg).toLocaleString()} กก.`
                        : "—"}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="mt-2">
            <p className="mb-1 text-[10px] font-semibold text-slate-700">หมายเหตุ</p>
            {notesText ? (
              <p className="whitespace-pre-wrap break-words text-[11px] leading-snug text-slate-900">
                {notesText}
              </p>
            ) : (
              <div className="space-y-3 pt-1" aria-hidden="true">
                <div className="w-full border-b border-dotted border-slate-500" />
                <div className="w-full border-b border-dotted border-slate-500" />
              </div>
            )}
          </section>
        </article>
      </div>
    </>
  )
}
