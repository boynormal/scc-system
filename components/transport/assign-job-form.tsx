"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Truck, User, Pencil, Plus } from "lucide-react"
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
  onAssignmentChange?: () => void
}

const LOCKED_STATUSES = ["completed", "cancelled"]

export function AssignJobForm({
  jobId,
  branchId,
  currentAssignment,
  jobStatus,
  onAssignmentChange,
}: Props) {
  const router = useRouter()
  const isLocked = LOCKED_STATUSES.includes(jobStatus)

  const [mode, setMode] = useState<"view" | "assigning">("view")
  const [vehicleId, setVehicleId] = useState("")
  const [driverId, setDriverId] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      onAssignmentChange?.()
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">การมอบหมาย</h3>
        {!isLocked && mode === "view" && (
          <button
            type="button"
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
                <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="font-medium text-foreground">{currentAssignment.vehicle.plateNumber}</div>
                  <div className="text-xs text-muted-foreground">
                    {currentAssignment.vehicle.name} · {currentAssignment.vehicle.vehicleType}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="font-medium text-foreground">
                    {currentAssignment.driver.firstName} {currentAssignment.driver.lastName}
                  </div>
                  {currentAssignment.driver.phone && (
                    <div className="text-xs text-muted-foreground">{currentAssignment.driver.phone}</div>
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                มอบหมายโดย: {currentAssignment.assignedByUser.firstName} {currentAssignment.assignedByUser.lastName}
              </div>
            </div>
          ) : (
            <div className="py-2 text-center">
              <p className="text-sm text-muted-foreground">ยังไม่ได้มอบหมาย</p>
              {!isLocked && (
                <button
                  type="button"
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
              type="button"
              onClick={handleAssign}
              disabled={saving || !vehicleId || !driverId}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก..." : currentAssignment ? "อัปเดตการมอบหมาย" : "ยืนยันมอบหมาย"}
            </button>
            <button
              type="button"
              onClick={() => { setMode("view"); setError(null) }}
              disabled={saving}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted/60"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
