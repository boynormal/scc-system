"use client"

import { useState } from "react"
import { Loader2, X } from "lucide-react"
import { GpsLinkWarning } from "@/components/transport/GpsLinkWarning"

export type DriverOption = {
  id: string
  firstName: string
  lastName: string
  code: string
}

type Props = {
  open: boolean
  jobNumber: string
  vehiclePlate: string
  gpsDeviceId?: string | null
  drivers: DriverOption[]
  onConfirm: (driverId: string) => Promise<void>
  onCancel: () => void
}

export function AssignDriverModal({
  open,
  jobNumber,
  vehiclePlate,
  gpsDeviceId,
  drivers,
  onConfirm,
  onCancel,
}: Props) {
  const [driverId, setDriverId] = useState(drivers[0]?.id ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleConfirm = async () => {
    if (!driverId) {
      setError("กรุณาเลือกคนขับ")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onConfirm(driverId)
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">เลือกคนขับ</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              มอบหมาย {jobNumber} → รถ {vehiclePlate}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <GpsLinkWarning gpsDeviceId={gpsDeviceId} plateNumber={vehiclePlate} compact />

        <div className="mt-3">
          <label className="block text-xs font-medium text-slate-600 mb-1">คนขับ</label>
          {drivers.length === 0 ? (
            <p className="text-sm text-red-600">ไม่มีคนขับผูกกับรถคันนี้ — กรุณามอบหมายจากหน้าใบงาน</p>
          ) : (
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.firstName} {d.lastName} ({d.code})
                </option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-600">{error}</p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || drivers.length === 0 || !driverId}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            ยืนยันมอบหมาย
          </button>
        </div>
      </div>
    </div>
  )
}
