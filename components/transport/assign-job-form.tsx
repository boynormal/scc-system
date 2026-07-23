"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Truck, User, Pencil, Trash2, Plus } from "lucide-react"
import { JobAssignmentPickers, type AssignmentDriver, type AssignmentVehicle } from "@/components/transport/JobAssignmentPickers"

type CurrentAssignment = {
  vehicle: { id: string; plateNumber: string; name: string; vehicleType: string }
  driver: { id: string; firstName: string; lastName: string; phone: string | null }
  assignedByUser: { firstName: string; lastName: string }
  assignedAt: string
} | null

type Props = {
  jobId: string
  branchId: string
  currentAssignment: CurrentAssignment
  jobStatus: string
}

const LOCKED_STATUSES = ["completed", "cancelled"]

export function AssignJobForm({ jobId, branchId, currentAssignment, jobStatus }: Props) {
  const router = useRouter()
  const isLocked = LOCKED_STATUSES.includes(jobStatus)

  const [mode, setMode] = useState<"view" | "assigning">("view")
  const [vehicleId, setVehicleId] = useState("")
  const [driverId, setDriverId] = useState("")
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    if (mode === "assigning") {
      if (currentAssignment) {
        setVehicleId(currentAssignment.vehicle.id)
        setDriverId(currentAssignment.driver.id)
      } else {
        setVehicleId("")
        setDriverId("")
      }
    }
  }, [mode, currentAssignment])

  const extraVehicles: AssignmentVehicle[] = currentAssignment
    ? [{
        id: currentAssignment.vehicle.id,
        plateNumber: currentAssignment.vehicle.plateNumber,
        name: currentAssignment.vehicle.name,
        vehicleType: currentAssignment.vehicle.vehicleType,
      }]
    : []

  const extraDrivers: AssignmentDriver[] = currentAssignment
    ? [{
        id: currentAssignment.driver.id,
        firstName: currentAssignment.driver.firstName,
        lastName: currentAssignment.driver.lastName,
        code: "",
        phone: currentAssignment.driver.phone,
      }]
    : []

  const handleAssign = async () => {
    if (!vehicleId || !driverId) {
      setError("กรุณาเลือกรถและคนขับ")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/transport/jobs/${jobId}/assignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId, driverId }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? "เกิดข้อผิดพลาด"); return }
      setMode("view")
      router.refresh()
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ")
    } finally {
      setSaving(false)
    }
  }

  const handleUnassign = async () => {
    setRemoving(true)
    setError(null)
    try {
      const res = await fetch(`/api/transport/jobs/${jobId}/assignment`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? "เกิดข้อผิดพลาด"); return }
      setConfirmRemove(false)
      router.refresh()
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ")
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">การมอบหมาย</h3>
        {!isLocked && mode === "view" && (
          <button
            onClick={() => setMode("assigning")}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-cyan-600 hover:bg-cyan-50"
          >
            {currentAssignment ? (
              <><Pencil className="h-3.5 w-3.5" /> เปลี่ยน</>
            ) : (
              <><Plus className="h-3.5 w-3.5" /> มอบหมายรถ</>
            )}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      {mode === "view" && (
        <>
          {currentAssignment ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <div className="font-medium text-slate-800">{currentAssignment.vehicle.plateNumber}</div>
                  <div className="text-xs text-slate-500">
                    {currentAssignment.vehicle.name} · {currentAssignment.vehicle.vehicleType}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <div className="font-medium text-slate-800">
                    {currentAssignment.driver.firstName} {currentAssignment.driver.lastName}
                  </div>
                  {currentAssignment.driver.phone && (
                    <div className="text-xs text-slate-500">{currentAssignment.driver.phone}</div>
                  )}
                </div>
              </div>
              <div className="text-xs text-slate-400">
                มอบหมายโดย: {currentAssignment.assignedByUser.firstName} {currentAssignment.assignedByUser.lastName}
              </div>

              {!isLocked && (
                <div className="border-t border-slate-100 pt-3">
                  {!confirmRemove ? (
                    <button
                      onClick={() => setConfirmRemove(true)}
                      className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> ยกเลิกมอบหมาย
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">ยืนยันยกเลิก?</span>
                      <button
                        onClick={handleUnassign}
                        disabled={removing}
                        className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {removing ? "กำลังยกเลิก..." : "ยืนยัน"}
                      </button>
                      <button
                        onClick={() => setConfirmRemove(false)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        ไม่
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="py-2 text-center">
              <p className="text-sm text-slate-400">ยังไม่ได้มอบหมาย</p>
              {!isLocked && (
                <button
                  onClick={() => setMode("assigning")}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
                >
                  <Plus className="h-4 w-4" /> มอบหมายรถ
                </button>
              )}
            </div>
          )}
        </>
      )}

      {mode === "assigning" && (
        <div className="space-y-3">
          <JobAssignmentPickers
            branchId={branchId}
            vehicleId={vehicleId}
            driverId={driverId}
            onVehicleChange={setVehicleId}
            onDriverChange={setDriverId}
            vehiclesScope="all"
            driversScope="all"
            extraVehicles={extraVehicles}
            extraDrivers={extraDrivers}
            vehicleLabel="รถ"
            driverLabel="คนขับ"
          />

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleAssign}
              disabled={saving || !vehicleId || !driverId}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก..." : currentAssignment ? "อัปเดตการมอบหมาย" : "ยืนยันมอบหมาย"}
            </button>
            <button
              onClick={() => { setMode("view"); setError(null) }}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
