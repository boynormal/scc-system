"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Loader2, X, Wrench } from "lucide-react"
import { GlassButton, GlassInput } from "@/components/glass"

type VehicleOption = {
  id: string
  plateNumber: string
  name: string
}

type Props = {
  open: boolean
  /** ถ้าระบุแล้วจะล็อกคันนั้น; ไม่ระบุ = ให้เลือกจาก dropdown */
  vehicleId?: string
  plateNumber?: string
  vehicleName?: string
  onSuccess: () => void
  onCancel: () => void
}

export function ReportRepairModal({
  open,
  vehicleId: lockedVehicleId,
  plateNumber: lockedPlate,
  vehicleName: lockedName,
  onSuccess,
  onCancel,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const [symptom, setSymptom] = useState("")
  const [notes, setNotes] = useState("")
  const [repairCost, setRepairCost] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickMode = !lockedVehicleId
  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [loadingVehicles, setLoadingVehicles] = useState(false)
  const [selectedVehicleId, setSelectedVehicleId] = useState("")

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    setSymptom("")
    setNotes("")
    setRepairCost("")
    setError(null)
    setSelectedVehicleId(lockedVehicleId ?? "")

    if (!pickMode) return

    let cancelled = false
    setLoadingVehicles(true)
    fetch("/api/transport/vehicles")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        const list = (json.data ?? []) as VehicleOption[]
        setVehicles(
          [...list].sort((a, b) => a.plateNumber.localeCompare(b.plateNumber, "th"))
        )
      })
      .catch(() => {
        if (!cancelled) setError("โหลดรายการรถไม่สำเร็จ")
      })
      .finally(() => {
        if (!cancelled) setLoadingVehicles(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, lockedVehicleId, pickMode])

  if (!mounted || !open) return null

  const selected = pickMode
    ? vehicles.find((v) => v.id === selectedVehicleId)
    : lockedVehicleId
      ? { id: lockedVehicleId, plateNumber: lockedPlate ?? "", name: lockedName ?? "" }
      : null

  const handleSubmit = async () => {
    const vehicleId = selected?.id
    if (!vehicleId) {
      setError("กรุณาเลือกรถ")
      return
    }
    if (!symptom.trim()) {
      setError("กรุณาระบุอาการ")
      return
    }

    let costValue: number | undefined
    const costRaw = repairCost.trim()
    if (costRaw !== "") {
      const n = Number(costRaw)
      if (Number.isNaN(n) || n < 0) {
        setError("ราคาซ่อมต้องเป็นตัวเลขที่ไม่ติดลบ")
        return
      }
      costValue = n
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/transport/repairs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId,
          symptom: symptom.trim(),
          notes: notes.trim() || undefined,
          repairCost: costValue,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "บันทึกใบแจ้งซ่อมไม่สำเร็จ")
        return
      }
      onSuccess()
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ")
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-foreground">แจ้งซ่อม</h3>
          </div>
          <button type="button" onClick={onCancel} className="rounded p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          {pickMode ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">รถ *</label>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                disabled={loadingVehicles}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">{loadingVehicles ? "กำลังโหลด..." : "-- เลือกทะเบียน --"}</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber} — {v.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              รถ <span className="font-mono font-medium text-foreground">{lockedPlate}</span>
              {" — "}
              {lockedName}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            สถานะรถจะยังไม่เปลี่ยน จนกว่าจะกด &quot;เข้าซ่อม&quot;
          </p>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">อาการ *</label>
            <textarea
              value={symptom}
              onChange={(e) => setSymptom(e.target.value)}
              rows={3}
              placeholder="เช่น เครื่องยนต์มีเสียงดัง, ยางรั่ว..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">หมายเหตุ</label>
            <GlassInput
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">ราคาซ่อม (บาท)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={repairCost}
              onChange={(e) => setRepairCost(e.target.value)}
              placeholder="ถ้าทราบราคาแล้ว"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            ยกเลิก
          </button>
          <GlassButton
            onClick={handleSubmit}
            disabled={saving || loadingVehicles}
            icon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
          >
            {saving ? "กำลังบันทึก..." : "บันทึกใบแจ้งซ่อม"}
          </GlassButton>
        </div>
      </div>
    </div>,
    document.body
  )
}
