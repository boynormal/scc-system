"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Loader2, X, Pencil } from "lucide-react"
import { GlassButton, GlassInput } from "@/components/glass"
import type { RepairStatus } from "@/components/transport/repairs/RepairStatusBadge"

type VehicleOption = {
  id: string
  plateNumber: string
  name: string
}

export type EditableRepair = {
  id: string
  symptom: string
  notes: string | null
  status: RepairStatus
  repairCost: string | number | null
  paymentMethod: "cash" | "credit" | null
  vehicle: { id: string; plateNumber: string; name: string }
}

type Props = {
  open: boolean
  repair: EditableRepair | null
  onSuccess: () => void
  onCancel: () => void
}

const STATUS_OPTIONS: { value: RepairStatus; label: string }[] = [
  { value: "reported", label: "แจ้งซ่อม" },
  { value: "in_repair", label: "กำลังซ่อม" },
  { value: "closed", label: "ปิดงาน" },
  { value: "cancelled", label: "ยกเลิก" },
]

function costToInput(value: string | number | null | undefined): string {
  if (value == null || value === "") return ""
  const n = typeof value === "number" ? value : Number(value)
  if (Number.isNaN(n)) return ""
  return String(n)
}

export function EditRepairModal({ open, repair, onSuccess, onCancel }: Props) {
  const [mounted, setMounted] = useState(false)
  const [vehicleId, setVehicleId] = useState("")
  const [symptom, setSymptom] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState<RepairStatus>("reported")
  const [repairCost, setRepairCost] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit">("cash")
  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [loadingVehicles, setLoadingVehicles] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open || !repair) return
    setVehicleId(repair.vehicle.id)
    setSymptom(repair.symptom)
    setNotes(repair.notes ?? "")
    setStatus(repair.status)
    setRepairCost(costToInput(repair.repairCost))
    setPaymentMethod(repair.paymentMethod === "credit" ? "credit" : "cash")
    setError(null)

    let cancelled = false
    setLoadingVehicles(true)
    fetch("/api/transport/vehicles")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        const list = (json.data ?? []) as VehicleOption[]
        const sorted = [...list].sort((a, b) => a.plateNumber.localeCompare(b.plateNumber, "th"))
        // keep current vehicle even if inactive/missing from active list
        if (!sorted.some((v) => v.id === repair.vehicle.id)) {
          sorted.unshift({
            id: repair.vehicle.id,
            plateNumber: repair.vehicle.plateNumber,
            name: repair.vehicle.name,
          })
        }
        setVehicles(sorted)
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
  }, [open, repair])

  if (!mounted || !open || !repair) return null

  const handleSubmit = async () => {
    if (!vehicleId) {
      setError("กรุณาเลือกรถ")
      return
    }
    if (!symptom.trim()) {
      setError("กรุณาระบุอาการ")
      return
    }

    let costValue: number | null = null
    const costRaw = repairCost.trim()
    if (costRaw !== "") {
      const n = Number(costRaw)
      if (Number.isNaN(n) || n < 0) {
        setError("ราคาซ่อมต้องเป็นตัวเลขที่ไม่ติดลบ")
        return
      }
      costValue = n
    }
    if (costValue != null && costValue > 0 && !paymentMethod) {
      setError("กรุณาเลือกวิธีจ่าย")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/transport/repairs/${repair.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId,
          symptom: symptom.trim(),
          notes: notes.trim() || null,
          repairCost: costValue,
          paymentMethod: costValue != null && costValue > 0 ? paymentMethod : null,
          status,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "บันทึกไม่สำเร็จ")
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
            <Pencil className="h-4 w-4 text-cyan-600" />
            <h3 className="text-sm font-semibold text-foreground">แก้ไขใบแจ้งซ่อม</h3>
          </div>
          <button type="button" onClick={onCancel} className="rounded p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">รถ *</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              disabled={loadingVehicles}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">{loadingVehicles ? "กำลังโหลด..." : "-- เลือกทะเบียน --"}</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id} style={{ backgroundColor: "#fff", color: "#0f172a" }}>
                  {v.plateNumber} — {v.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">อาการ *</label>
            <textarea
              value={symptom}
              onChange={(e) => setSymptom(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">หมายเหตุ</label>
            <GlassInput value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">ราคาซ่อม (บาท)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={repairCost}
              onChange={(e) => setRepairCost(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">วิธีจ่าย</label>
            <div className="flex gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="editPaymentMethod"
                  checked={paymentMethod === "cash"}
                  onChange={() => setPaymentMethod("cash")}
                />
                เงินสด
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="editPaymentMethod"
                  checked={paymentMethod === "credit"}
                  onChange={() => setPaymentMethod("credit")}
                />
                เครดิต
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">สถานะ *</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as RepairStatus)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value} style={{ backgroundColor: "#fff", color: "#0f172a" }}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              เปลี่ยนเป็นกำลังซ่อมจะตั้งรถเป็นซ่อมบำรุง · แจ้งซ่อม/ปิด/ยกเลิกจะคืนรถเป็นพร้อมใช้หากกำลังซ่อมอยู่
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
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
            icon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </GlassButton>
        </div>
      </div>
    </div>,
    document.body
  )
}
