"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { createPortal } from "react-dom"
import { Loader2, X, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GpsVehicleData } from "@/app/api/transport/gps/route"
import {
  linkGpsToVehicle,
  createVehicleWithGps,
  platesMismatch,
  filterLinkableGps,
  fetchGpsVehicles,
  type MasterVehicleOption,
  type UnmatchedGpsOption,
} from "@/components/transport/gps/gps-link-utils"

type Branch = { id: string; name: string }
type VehicleType = { id: string; name: string }

export type GpsVehicleInput = {
  plateNumber: string
  imei: string
}

type Props = {
  open: boolean
  /** Pre-selected GPS vehicle (from map). Omit to pick from linkable list. */
  gpsVehicle?: GpsVehicleInput | null
  /** Full GPS feed — used to build linkable IMEI list */
  gpsVehicles?: GpsVehicleData[]
  /** @deprecated use gpsVehicles — kept for callers that only pass unmatched */
  unmatchedOptions?: UnmatchedGpsOption[]
  /** Pre-select master vehicle when opening from VehiclesTab row */
  preselectedVehicleId?: string | null
  masterVehicles?: MasterVehicleOption[]
  branches?: Branch[]
  vehicleTypes?: VehicleType[]
  onSuccess: () => void
  onCancel: () => void
}

type Mode = "link" | "create"

export function LinkGpsVehicleModal({
  open,
  gpsVehicle: gpsVehicleProp,
  gpsVehicles: gpsVehiclesProp,
  unmatchedOptions = [],
  preselectedVehicleId,
  masterVehicles: masterVehiclesProp,
  branches: branchesProp,
  vehicleTypes: vehicleTypesProp,
  onSuccess,
  onCancel,
}: Props) {
  const [mode, setMode] = useState<Mode>("link")
  const [masterVehicles, setMasterVehicles] = useState<MasterVehicleOption[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)

  const [selectedGpsId, setSelectedGpsId] = useState("")
  const [selectedVehicleId, setSelectedVehicleId] = useState("")
  const [branchId, setBranchId] = useState("")
  const [name, setName] = useState("")
  const [vehicleType, setVehicleType] = useState("")
  const [maxWeightKg, setMaxWeightKg] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [gpsVehicles, setGpsVehicles] = useState<GpsVehicleData[]>(gpsVehiclesProp ?? [])
  const [loadingGps, setLoadingGps] = useState(false)
  const wasOpenRef = useRef(false)
  const gpsInitRef = useRef(false)

  const gpsImei = gpsVehicleProp?.imei?.trim() ?? ""
  const gpsPlate = gpsVehicleProp?.plateNumber ?? ""

  const linkableOptions = useMemo(
    () => filterLinkableGps(gpsVehicles, masterVehicles),
    [gpsVehicles, masterVehicles]
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  // Initialize form only when modal opens — not on every parent re-render (e.g. map countdown poll)
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current
    if (open) {
      wasOpenRef.current = true
    } else {
      wasOpenRef.current = false
      return
    }
    if (!justOpened) return
    gpsInitRef.current = false

    setMode("link")
    setSelectedVehicleId(preselectedVehicleId ?? "")
    setSelectedGpsId("")
    setBranchId(branchesProp?.length === 1 ? branchesProp[0].id : "")
    setName(gpsPlate && gpsPlate !== "—" ? gpsPlate : "")
    setVehicleType("")
    setMaxWeightKg("")
    setError(null)
    setMetaError(null)

    let metaCancelled = false
    let gpsCancelled = false

    if (masterVehiclesProp && branchesProp && vehicleTypesProp) {
      setMasterVehicles(masterVehiclesProp)
      setBranches(branchesProp)
      setVehicleTypes(vehicleTypesProp)
      if (branchesProp.length === 1) setBranchId(branchesProp[0].id)
      setLoadingMeta(false)
    } else {
      setLoadingMeta(true)
      Promise.all([
        fetch("/api/transport/vehicles?includeInactive=true").then((r) => r.json()),
        fetch("/api/settings/branches").then((r) => r.json()),
        fetch("/api/transport/master-data/vehicle-types?activeOnly=1").then((r) => r.json()),
      ])
        .then(([vJson, bJson, tJson]) => {
          if (metaCancelled) return
          setMasterVehicles(vJson.data ?? [])
          const bl: Branch[] = bJson.data ?? []
          setBranches(bl)
          setVehicleTypes(tJson.data ?? [])
          if (bl.length === 1) setBranchId(bl[0].id)
        })
        .catch(() => {
          if (!metaCancelled) setMetaError("โหลดข้อมูลรถ/สาขาไม่ได้")
        })
        .finally(() => {
          if (!metaCancelled) setLoadingMeta(false)
        })
    }

    if (gpsVehiclesProp?.length) {
      setGpsVehicles(gpsVehiclesProp)
      setLoadingGps(false)
    } else {
      setLoadingGps(true)
      fetchGpsVehicles()
        .then((data) => {
          if (!gpsCancelled) setGpsVehicles(data)
        })
        .catch(() => {
          if (!gpsCancelled) setMetaError("โหลดข้อมูล GPS ไม่ได้")
        })
        .finally(() => {
          if (!gpsCancelled) setLoadingGps(false)
        })
    }

    return () => {
      metaCancelled = true
      gpsCancelled = true
    }
  }, [
    open,
    gpsImei,
    gpsPlate,
    preselectedVehicleId,
    masterVehiclesProp,
    branchesProp,
    vehicleTypesProp,
    gpsVehiclesProp,
  ])

  // Pick default GPS option once linkable list is ready
  useEffect(() => {
    if (!open || gpsInitRef.current || linkableOptions.length === 0) return
    gpsInitRef.current = true
    if (gpsImei) {
      const found = linkableOptions.find((g) => g.imei === gpsImei)
      if (found) setSelectedGpsId(found.id)
    } else if (linkableOptions.length === 1) {
      setSelectedGpsId(linkableOptions[0].id)
    }
  }, [open, gpsImei, linkableOptions])
  if (!open || !mounted) return null

  const pickedGps =
    gpsImei
      ? { plateNumber: gpsPlate, imei: gpsImei }
      : (() => {
          const g = linkableOptions.find((o) => o.id === selectedGpsId)
          return g ? { plateNumber: g.plateNumber, imei: g.imei } : null
        })()
  const unlinkedVehicles = masterVehicles.filter((v) => !v.gpsDeviceId?.trim())
  const selectedVehicle = unlinkedVehicles.find((v) => v.id === selectedVehicleId)
  const showPlateMismatch =
    mode === "link" &&
    selectedVehicle &&
    pickedGps &&
    platesMismatch(pickedGps.plateNumber, selectedVehicle.plateNumber)

  const handleSubmit = async () => {
    if (!pickedGps?.imei?.trim()) {
      setError("กรุณาเลือกทะเบียนจาก GPS")
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (mode === "link") {
        if (!selectedVehicleId) {
          setError("กรุณาเลือกรถในระบบ")
          return
        }
        await linkGpsToVehicle(selectedVehicleId, pickedGps.imei)
      } else {
        if (!branchId || !name.trim() || !vehicleType) {
          setError("กรุณากรอกสาขา ชื่อรถ และประเภทรถ")
          return
        }
        const plate =
          pickedGps.plateNumber && pickedGps.plateNumber !== "—"
            ? pickedGps.plateNumber
            : name.trim()
        await createVehicleWithGps({
          branchId,
          plateNumber: plate,
          name: name.trim(),
          vehicleType,
          gpsDeviceId: pickedGps.imei,
          maxWeightKg: maxWeightKg ? Number(maxWeightKg) : undefined,
        })
      }
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด")
    } finally {
      setSaving(false)
    }
  }

  const selectClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-gps-modal-title"
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 id="link-gps-modal-title" className="text-sm font-semibold text-slate-900">ผูก GPS กับ Master Data</h3>
            <p className="mt-0.5 text-xs text-slate-500">เลือกทะเบียนจาก GPS — IMEI จะถูกบันทึกอัตโนมัติ</p>
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

        {/* GPS info read-only or picker */}
        {!gpsImei && linkableOptions.length > 0 ? (
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">ทะเบียนจาก GPS *</label>
            <select
              value={selectedGpsId}
              onChange={(e) => {
                setSelectedGpsId(e.target.value)
                const g = linkableOptions.find((o) => o.id === e.target.value)
                if (g && g.plateNumber !== "—") setName(g.plateNumber)
              }}
              className={selectClass}
              disabled={loadingGps}
            >
              <option value="">-- เลือกทะเบียน GPS --</option>
              {linkableOptions.map((g) => (
                <option key={g.id} value={g.id}>{g.plateNumber} · IMEI {g.imei}</option>
              ))}
            </select>
          </div>
        ) : null}

        {pickedGps && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">ทะเบียน GPS</span>
              <span className="font-mono font-semibold text-slate-900">{pickedGps.plateNumber || "—"}</span>
            </div>
            <div className="mt-1 flex justify-between gap-2">
              <span className="text-slate-500">IMEI</span>
              <span className="font-mono text-xs text-slate-800">{pickedGps.imei}</span>
            </div>
          </div>
        )}

        {!pickedGps && !gpsImei && !loadingGps && linkableOptions.length === 0 && (
          <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            ไม่มี IMEI จาก GPS ที่ยังไม่ถูกผูกกับรถในระบบ
          </div>
        )}

        {metaError && (
          <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            {metaError}
          </div>
        )}

        {/* Mode tabs */}
        <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              { key: "link" as const, label: "ผูกกับรถที่มี" },
              { key: "create" as const, label: "สร้างรถใหม่" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setMode(t.key)}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                mode === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loadingMeta || loadingGps ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
          </div>
        ) : mode === "link" ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">รถในระบบ (ยังไม่ผูก GPS)</label>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className={selectClass}
              >
                <option value="">-- เลือกรถ --</option>
                {unlinkedVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plateNumber} — {v.name}
                  </option>
                ))}
              </select>
              {unlinkedVehicles.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">ไม่มีรถที่ยังไม่ผูก GPS — ลองสร้างรถใหม่</p>
              )}
            </div>
            {showPlateMismatch && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  ทะเบียน GPS ({pickedGps.plateNumber}) ไม่ตรงกับรถที่เลือก ({selectedVehicle?.plateNumber})
                  — ยังผูกได้ แต่ควรตรวจสอบให้แน่ใจ
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">สาขา *</label>
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={selectClass}>
                <option value="">-- เลือกสาขา --</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">ชื่อรถ *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={selectClass}
                placeholder="ชื่อเรียกรถ"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">ประเภทรถ *</label>
              <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className={selectClass}>
                <option value="">-- เลือกประเภท --</option>
                {vehicleTypes.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">น้ำหนักรถเปล่า (กก.)</label>
              <input
                type="number"
                min={0}
                step="any"
                value={maxWeightKg}
                onChange={(e) => setMaxWeightKg(e.target.value)}
                className={selectClass}
                placeholder="เช่น 15000"
              />
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 text-xs text-red-600">{error}</p>
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
            onClick={handleSubmit}
            disabled={saving || loadingMeta || loadingGps}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "link" ? "ผูก GPS" : "สร้างและผูก"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
