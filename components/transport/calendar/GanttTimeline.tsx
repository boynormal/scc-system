"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import type { CalendarJob } from "@/app/api/transport/calendar/route"
import { JobPopover, PRIORITY_CONFIG, STATUS_LABEL } from "./JobPopover"
import { AssignDriverModal, type DriverOption } from "./AssignDriverModal"

export type GanttVehicle = {
  id: string
  plateNumber: string
  name: string
  gpsDeviceId?: string | null
  branchId?: string
}

type Props = {
  weekStart: Date
  jobs: CalendarJob[]
  vehicles: GanttVehicle[]
  onAssigned?: () => void
}

type DragPayload = {
  jobId: string
  sourceDayIdx: number
  sourceVehicleId: string | "unassigned"
}

type PendingAssign = {
  jobId: string
  jobNumber: string
  vehicleId: string
  vehiclePlate: string
  gpsDeviceId: string | null
  branchId: string
  drivers: DriverOption[]
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

const DAY_SHORT = ["อา", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."]
const MONTH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
const DRAG_MIME = "application/x-transport-job"

export function GanttTimeline({ weekStart, jobs, vehicles: allVehicles, onAssigned }: Props) {
  const [selectedJob, setSelectedJob] = useState<{ job: CalendarJob; dayIdx: number; vehicleId: string } | null>(null)
  const [dropTarget, setDropTarget] = useState<{ vehicleId: string; dayIdx: number } | null>(null)
  const [pendingAssign, setPendingAssign] = useState<PendingAssign | null>(null)
  const [assigning, setAssigning] = useState(false)
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const today = new Date()

  const vehicles = useMemo(() => {
    const map = new Map<string, GanttVehicle>()
    for (const v of allVehicles) map.set(v.id, v)
    for (const job of jobs) {
      if (job.vehicle && !map.has(job.vehicle.id)) {
        map.set(job.vehicle.id, { ...job.vehicle })
      }
    }
    return [...map.values()].sort((a, b) => a.plateNumber.localeCompare(b.plateNumber))
  }, [allVehicles, jobs])

  const unassignedJobs = jobs.filter((j) => !j.vehicle)

  const jobsForVehicleDay = (vehicleId: string, day: Date) =>
    jobs.filter(
      (j) => j.vehicle?.id === vehicleId && isSameDay(new Date(j.scheduledDate), day)
    )

  const jobsUnassignedDay = (day: Date) =>
    unassignedJobs.filter((j) => isSameDay(new Date(j.scheduledDate), day))

  const postAssignment = async (jobId: string, vehicleId: string, driverId: string) => {
    const res = await fetch(`/api/transport/jobs/${jobId}/assignment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId, driverId }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "มอบหมายไม่สำเร็จ")
  }

  const resolveDrivers = async (branchId: string, vehicleId: string): Promise<DriverOption[]> => {
    const res = await fetch(`/api/transport/drivers?branchId=${branchId}`)
    const json = await res.json()
    return (json.data ?? [])
      .filter((d: { assignedVehicleId?: string | null }) => d.assignedVehicleId === vehicleId)
      .map((d: { id: string; firstName: string; lastName: string; code: string }) => ({
        id: d.id,
        firstName: d.firstName,
        lastName: d.lastName,
        code: d.code,
      }))
  }

  const handleDropOnVehicle = async (
    payload: DragPayload,
    targetVehicleId: string,
    targetDayIdx: number
  ) => {
    const job = jobs.find((j) => j.id === payload.jobId)
    if (!job) return

    const jobDayIdx = days.findIndex((day) => isSameDay(day, new Date(job.scheduledDate)))
    if (jobDayIdx !== targetDayIdx) {
      setToast({ type: "error", message: "วางได้เฉพาะคอลัมน์วันเดียวกับวันนัดของใบงาน" })
      return
    }

    if (payload.sourceVehicleId === targetVehicleId) return

    if (job.status === "completed" || job.status === "cancelled") {
      setToast({ type: "error", message: "ไม่สามารถมอบหมายใบงานที่จบหรือยกเลิกแล้ว" })
      return
    }

    const vehicle = vehicles.find((v) => v.id === targetVehicleId)
    if (!vehicle) return

    setAssigning(true)
    try {
      const drivers = await resolveDrivers(job.branchId, targetVehicleId)

      if (drivers.length === 1) {
        await postAssignment(job.id, targetVehicleId, drivers[0].id)
        setToast({ type: "success", message: `มอบหมาย ${job.jobNumber} → ${vehicle.plateNumber} สำเร็จ` })
        onAssigned?.()
      } else {
        setPendingAssign({
          jobId: job.id,
          jobNumber: job.jobNumber,
          vehicleId: targetVehicleId,
          vehiclePlate: vehicle.plateNumber,
          gpsDeviceId: vehicle.gpsDeviceId ?? null,
          branchId: job.branchId,
          drivers,
        })
      }
    } catch (e) {
      setToast({
        type: "error",
        message: e instanceof Error ? e.message : "มอบหมายไม่สำเร็จ",
      })
    } finally {
      setAssigning(false)
      setDropTarget(null)
    }
  }

  const handleDragStart = (e: React.DragEvent, payload: DragPayload) => {
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload))
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, vehicleId: string, dayIdx: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDropTarget({ vehicleId, dayIdx })
  }

  const handleDrop = (e: React.DragEvent, vehicleId: string, dayIdx: number) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData(DRAG_MIME)
    if (!raw) return
    try {
      const payload = JSON.parse(raw) as DragPayload
      handleDropOnVehicle(payload, vehicleId, dayIdx)
    } catch {
      setToast({ type: "error", message: "ข้อมูล drag ไม่ถูกต้อง" })
    }
  }

  const renderJobChip = (
    job: CalendarJob,
    dayIdx: number,
    vehicleId: string,
    variant: "assigned" | "unassigned",
    p: (typeof PRIORITY_CONFIG)[keyof typeof PRIORITY_CONFIG]
  ) => {
    const isSelected =
      selectedJob?.job.id === job.id &&
      selectedJob?.dayIdx === dayIdx &&
      selectedJob?.vehicleId === vehicleId
    const draggable = job.status !== "completed" && job.status !== "cancelled"

    return (
      <div key={job.id} className="relative">
        <button
          draggable={draggable}
          onDragStart={(e) =>
            draggable &&
            handleDragStart(e, { jobId: job.id, sourceDayIdx: dayIdx, sourceVehicleId: vehicleId })
          }
          onClick={() =>
            setSelectedJob(isSelected ? null : { job, dayIdx, vehicleId })
          }
          title={draggable ? "ลากไปวางที่แถวรถเพื่อมอบหมาย" : undefined}
          className={cn(
            "w-full rounded-md px-2 py-1.5 text-left transition-opacity hover:opacity-90",
            variant === "assigned" ? cn(p.bg, p.text) : cn(p.light, "border border-dashed border-current"),
            draggable && "cursor-grab active:cursor-grabbing"
          )}
        >
          <div className="text-[11px] font-bold truncate">{job.jobNumber}</div>
          {job.customerName && (
            <div className="text-[10px] opacity-80 truncate">{job.customerName}</div>
          )}
          {variant === "assigned" && (
            <div className="text-[10px] opacity-70">
              {STATUS_LABEL[job.status] ?? job.status} · {job.stopsCount} จุด
            </div>
          )}
        </button>
        {isSelected && (
          <div className="relative z-50">
            <JobPopover job={job} onClose={() => setSelectedJob(null)} />
          </div>
        )}
      </div>
    )
  }

  if (jobs.length === 0 && vehicles.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
        ไม่มีใบงานในช่วงนี้
      </div>
    )
  }

  return (
    <>
      {toast && (
        <div
          className={cn(
            "mb-3 rounded-lg px-4 py-2 text-sm",
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          )}
        >
          {toast.message}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 text-xs underline opacity-70"
          >
            ปิด
          </button>
        </div>
      )}

      {unassignedJobs.length > 0 && (
        <p className="mb-2 text-xs text-slate-500">
          ลากใบงานจากแถว &quot;ยังไม่มอบหมายรถ&quot; ไปวางที่แถวรถ (วันเดียวกับวันนัด)
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="w-40 border-b border-r border-slate-200 px-4 py-3 text-left text-xs font-semibold text-slate-500">
                ทะเบียนรถ
              </th>
              {days.map((day, i) => {
                const isToday = isSameDay(day, today)
                const isWeekend = day.getDay() === 0 || day.getDay() === 6
                return (
                  <th
                    key={i}
                    className={cn(
                      "min-w-[120px] border-b border-r border-slate-200 px-2 py-3 text-center text-xs font-semibold",
                      isToday ? "bg-cyan-50 text-cyan-700" : isWeekend ? "text-slate-400" : "text-slate-600"
                    )}
                  >
                    <div>{DAY_SHORT[day.getDay()]}</div>
                    <div className={cn("text-base font-bold", isToday && "text-cyan-600")}>
                      {day.getDate()}
                    </div>
                    <div className="font-normal text-slate-400">{MONTH_SHORT[day.getMonth()]}</div>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id} className="hover:bg-slate-50/50">
                <td className="border-r border-slate-200 px-4 py-3">
                  <div className="font-semibold text-slate-800">{vehicle.plateNumber}</div>
                  <div className="text-xs text-slate-400 truncate max-w-[120px]">{vehicle.name}</div>
                </td>
                {days.map((day, dayIdx) => {
                  const dayJobs = jobsForVehicleDay(vehicle.id, day)
                  const isToday = isSameDay(day, today)
                  const isDropTarget =
                    dropTarget?.vehicleId === vehicle.id && dropTarget?.dayIdx === dayIdx
                  return (
                    <td
                      key={dayIdx}
                      onDragOver={(e) => handleDragOver(e, vehicle.id, dayIdx)}
                      onDragLeave={() => setDropTarget(null)}
                      onDrop={(e) => handleDrop(e, vehicle.id, dayIdx)}
                      className={cn(
                        "relative border-r border-slate-100 px-1.5 py-2 align-top min-h-[48px]",
                        isToday && "bg-cyan-50/30",
                        isDropTarget && "bg-cyan-100/60 ring-2 ring-inset ring-cyan-400"
                      )}
                    >
                      <div className="space-y-1">
                        {dayJobs.map((job) => {
                          const p =
                            PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG] ??
                            PRIORITY_CONFIG.normal
                          return renderJobChip(job, dayIdx, vehicle.id, "assigned", p)
                        })}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}

            {unassignedJobs.length > 0 && (
              <tr className="bg-amber-50/30 hover:bg-amber-50/50">
                <td className="border-r border-slate-200 px-4 py-3">
                  <div className="text-xs font-semibold text-amber-700">ยังไม่มอบหมายรถ</div>
                  <div className="text-[10px] text-amber-600/80">ลากไปวางที่แถวรถ</div>
                </td>
                {days.map((day, dayIdx) => {
                  const dayJobs = jobsUnassignedDay(day)
                  const isToday = isSameDay(day, today)
                  return (
                    <td
                      key={dayIdx}
                      className={cn(
                        "relative border-r border-slate-100 px-1.5 py-2 align-top",
                        isToday && "bg-cyan-50/30"
                      )}
                    >
                      <div className="space-y-1">
                        {dayJobs.map((job) => {
                          const p =
                            PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG] ??
                            PRIORITY_CONFIG.normal
                          return renderJobChip(job, dayIdx, "unassigned", "unassigned", p)
                        })}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {assigning && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 text-sm text-white">
          กำลังมอบหมาย...
        </div>
      )}

      <AssignDriverModal
        open={!!pendingAssign}
        jobNumber={pendingAssign?.jobNumber ?? ""}
        vehiclePlate={pendingAssign?.vehiclePlate ?? ""}
        gpsDeviceId={pendingAssign?.gpsDeviceId}
        drivers={pendingAssign?.drivers ?? []}
        onCancel={() => setPendingAssign(null)}
        onConfirm={async (driverId) => {
          if (!pendingAssign) return
          await postAssignment(pendingAssign.jobId, pendingAssign.vehicleId, driverId)
          setPendingAssign(null)
          setToast({
            type: "success",
            message: `มอบหมาย ${pendingAssign.jobNumber} → ${pendingAssign.vehiclePlate} สำเร็จ`,
          })
          onAssigned?.()
        }}
      />
    </>
  )
}
