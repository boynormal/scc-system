"use client"

import Link from "next/link"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CalendarJob } from "@/app/api/transport/calendar/route"

export const PRIORITY_CONFIG = {
  urgent: { label: "ด่วนมาก", bg: "bg-red-500", text: "text-white", light: "bg-red-100 text-red-700" },
  high: { label: "สูง", bg: "bg-orange-400", text: "text-white", light: "bg-orange-100 text-orange-700" },
  normal: { label: "ปกติ", bg: "bg-cyan-500", text: "text-white", light: "bg-cyan-100 text-cyan-700" },
  low: { label: "ต่ำ", bg: "bg-slate-400", text: "text-white", light: "bg-slate-100 text-slate-600" },
} as const

export const STATUS_LABEL: Record<string, string> = {
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

type Props = {
  job: CalendarJob
  onClose: () => void
}

export function JobPopover({ job, onClose }: Props) {
  const priority = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.normal
  const scheduledDate = new Date(job.scheduledDate)

  return (
    <div className="absolute z-50 w-72 rounded-xl border border-slate-200 bg-white shadow-xl"
      style={{ top: "100%", left: 0, marginTop: 4 }}
    >
      {/* Header */}
      <div className={cn("flex items-start justify-between rounded-t-xl px-4 py-3", priority.bg, priority.text)}>
        <div>
          <p className="text-xs font-medium opacity-80">{priority.label}</p>
          <p className="text-base font-bold">{job.jobNumber}</p>
        </div>
        <button onClick={onClose} className="mt-0.5 rounded-full p-0.5 hover:bg-white/20">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="space-y-2.5 p-4 text-sm">
        <Row label="วันที่" value={scheduledDate.toLocaleDateString("th-TH", { dateStyle: "medium" })} />
        <Row label="ประเภทงาน" value={job.jobType} />
        {job.customerName && <Row label="ลูกค้า" value={job.customerName} />}
        <Row label="สถานะ" value={STATUS_LABEL[job.status] ?? job.status} />
        <Row
          label="รถ"
          value={job.vehicle ? `${job.vehicle.plateNumber} (${job.vehicle.name})` : "ยังไม่มอบหมาย"}
        />
        {job.driver && (
          <Row label="คนขับ" value={`${job.driver.firstName} ${job.driver.lastName}`} />
        )}
        <Row label="จุดแวะ" value={`${job.stopsCount} จุด`} />
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 px-4 py-3">
        <Link
          href={`/transport/jobs/${job.id}`}
          className="block w-full rounded-lg bg-slate-900 py-1.5 text-center text-xs font-semibold text-white hover:bg-slate-700"
        >
          ดูรายละเอียด →
        </Link>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  )
}
