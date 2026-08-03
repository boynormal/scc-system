"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Edit2, Trash2, Save, X, Loader2 } from "lucide-react"
import { GlassCard, GlassInput } from "@/components/glass"
import { VehicleStatusBadge } from "@/components/transport/vehicle-status-badge"
import {
  fetchGpsVehicles,
  filterLinkableGps,
} from "@/components/transport/gps/gps-link-utils"
import type { GpsVehicleData } from "@/app/api/transport/gps/route"
import { DetailsDisplay, DetailsField } from "@/components/transport/master-data/DetailsField"
import { includesSearch } from "@/components/transport/master-data/transport-code-utils"

type Branch = { id: string; name: string; code: string }
type VehicleType = { id: string; name: string; isActive: boolean }
type Vehicle = {
  id: string
  branchId: string
  plateNumber: string
  name: string
  vehicleType: string
  maxWeightKg: string | null
  loadCapacityKg: string | null
  volumeM3: string | null
  gpsDeviceId: string | null
  notes: string | null
  currentStatus: string
  isActive: boolean
  branch: { id: string; name: string }
}

type FormState = {
  branchId: string
  plateNumber: string
  name: string
  vehicleType: string
  maxWeightKg: string
  loadCapacityKg: string
  volumeM3: string
  notes: string
  linkGpsId: string
}

const emptyForm: FormState = {
  branchId: "",
  plateNumber: "",
  name: "",
  vehicleType: "",
  maxWeightKg: "",
  loadCapacityKg: "",
  volumeM3: "",
  notes: "",
  linkGpsId: "",
}

type Props = {
  search?: string
  addRequest?: number
}

export function VehiclesTab({ search = "", addRequest = 0 }: Props) {
  const [data, setData] = useState<Vehicle[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm)

  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [gpsVehicles, setGpsVehicles] = useState<GpsVehicleData[]>([])

  const linkableGps = useMemo(
    () => filterLinkableGps(gpsVehicles, data),
    [gpsVehicles, data]
  )

  const filtered = useMemo(
    () =>
      data.filter((item) =>
        includesSearch(
          [item.plateNumber, item.name, item.vehicleType, item.branch.name, item.gpsDeviceId, item.notes],
          search
        )
      ),
    [data, search]
  )

  const lastAddRequest = useRef(0)
  useEffect(() => {
    if (!addRequest || addRequest === lastAddRequest.current) return
    lastAddRequest.current = addRequest
    setEditingId("new")
    setEditForm({ ...emptyForm, branchId: branches.length === 1 ? branches[0].id : "" })
  }, [addRequest, branches])

  const editSelectedGps = linkableGps.find((g) => g.id === editForm.linkGpsId)

  const startEditVehicle = (item: Vehicle, preselectGpsId = "") => {
    setEditingId(item.id)
    setEditForm({
      branchId: item.branchId,
      plateNumber: item.plateNumber,
      name: item.name,
      vehicleType: item.vehicleType,
      maxWeightKg: item.maxWeightKg ?? "",
      loadCapacityKg: item.loadCapacityKg ?? "",
      volumeM3: item.volumeM3 ?? "",
      notes: item.notes ?? "",
      linkGpsId: preselectGpsId,
    })
  }

  const loadGps = useCallback(async () => {
    setGpsLoading(true)
    setGpsError(null)
    try {
      const gpsData = await fetchGpsVehicles()
      setGpsVehicles(gpsData)
    } catch (e) {
      setGpsError(e instanceof Error ? e.message : "ไม่สามารถโหลดข้อมูล GPS ได้")
      setGpsVehicles([])
    } finally {
      setGpsLoading(false)
    }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    const [vehiclesRes, branchesRes, typesRes] = await Promise.all([
      fetch("/api/transport/vehicles?includeInactive=true"),
      fetch("/api/settings/branches"),
      fetch("/api/transport/master-data/vehicle-types?activeOnly=1"),
    ])
    const [vehiclesJson, branchesJson, typesJson] = await Promise.all([
      vehiclesRes.json(),
      branchesRes.json(),
      typesRes.json(),
    ])
    setData(vehiclesJson.data ?? [])
    setBranches(branchesJson.data ?? [])
    setVehicleTypes(typesJson.data ?? [])
    setLoading(false)
    loadGps()
  }, [loadGps])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSave = async (id?: string) => {
    if (!editForm.branchId || !editForm.plateNumber || !editForm.name || !editForm.vehicleType) {
      return alert("กรุณากรอกสาขา ทะเบียน ชื่อรถ และประเภทรถ")
    }
    const selectedGps = linkableGps.find((g) => g.id === editForm.linkGpsId)
    const payload = {
      branchId: editForm.branchId,
      plateNumber: editForm.plateNumber.trim(),
      name: editForm.name.trim(),
      vehicleType: editForm.vehicleType,
      maxWeightKg: editForm.maxWeightKg ? Number(editForm.maxWeightKg) : undefined,
      loadCapacityKg: editForm.loadCapacityKg ? Number(editForm.loadCapacityKg) : undefined,
      volumeM3: editForm.volumeM3 ? Number(editForm.volumeM3) : undefined,
      notes: editForm.notes.trim() || undefined,
      ...(selectedGps ? { gpsDeviceId: selectedGps.imei } : {}),
    }

    const res = await fetch(id === "new" ? "/api/transport/vehicles" : `/api/transport/vehicles/${id}`, {
      method: id === "new" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      setEditingId(null)
      loadData()
    } else {
      const b = await res.json()
      alert(typeof b.error === "string" ? b.error : b.error?.message ?? "เกิดข้อผิดพลาด")
    }
  }

  const handleDeactivate = async (id: string) => {
    if (!confirm("ปิดใช้งานรถคันนี้?")) return
    const res = await fetch(`/api/transport/vehicles/${id}`, { method: "DELETE" })
    if (res.ok) loadData()
  }

  const handleReactivate = async (id: string) => {
    const res = await fetch(`/api/transport/vehicles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    })
    if (res.ok) loadData()
  }

  const fieldClass =
    "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground dark:border-slate-500 dark:bg-slate-950/55 focus:outline-none focus:ring-2 focus:ring-cyan-500"

  const renderForm = (id: string, itemGpsDeviceId?: string | null) => (
    <>
      <td className="px-4 py-3">
        <select value={editForm.branchId} onChange={(e) => setEditForm((f) => ({ ...f, branchId: e.target.value }))} className={fieldClass}>
          <option value="">-- สาขา --</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3"><GlassInput value={editForm.plateNumber} onChange={(e) => setEditForm((f) => ({ ...f, plateNumber: e.target.value }))} className="h-8 border-cyan-300" /></td>
      <td className="px-4 py-3"><GlassInput value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="h-8 border-cyan-300" /></td>
      <td className="px-4 py-3">
        <select value={editForm.vehicleType} onChange={(e) => setEditForm((f) => ({ ...f, vehicleType: e.target.value }))} className={fieldClass}>
          <option value="">-- ประเภทรถ --</option>
          {vehicleTypes.map((t) => (
            <option key={t.id} value={t.name}>{t.name}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3"><GlassInput type="number" min={0} value={editForm.maxWeightKg} onChange={(e) => setEditForm((f) => ({ ...f, maxWeightKg: e.target.value }))} placeholder="น้ำหนักรถเปล่า" className="h-8 border-cyan-300" /></td>
      <td className="px-4 py-3"><GlassInput type="number" min={0} value={editForm.loadCapacityKg} onChange={(e) => setEditForm((f) => ({ ...f, loadCapacityKg: e.target.value }))} placeholder="น้ำหนักรวมสูงสุด" className="h-8 border-cyan-300" /></td>
      <td className="px-4 py-3">
        {itemGpsDeviceId ? (
          <span className="font-mono text-xs text-foreground">{itemGpsDeviceId}</span>
        ) : (
          <div className="space-y-1">
            <select
              value={editForm.linkGpsId}
              onChange={(e) => setEditForm((f) => ({ ...f, linkGpsId: e.target.value }))}
              disabled={gpsLoading || linkableGps.length === 0}
              className={fieldClass}
            >
              <option value="">-- เลือกทะเบียน GPS --</option>
              {linkableGps.map((g) => (
                <option key={g.id} value={g.id}>{g.plateNumber} · IMEI {g.imei}</option>
              ))}
            </select>
            {editSelectedGps && (
              <p className="text-[10px] text-muted-foreground font-mono">IMEI: {editSelectedGps.imei}</p>
            )}
          </div>
        )}
      </td>
      <td className="min-w-0 px-4 py-3 align-top">
        <DetailsField value={editForm.notes} onChange={(notes) => setEditForm((f) => ({ ...f, notes }))} />
      </td>
      <td className="px-4 py-3 align-top">-</td>
      <td className="px-4 py-3 text-right space-x-2 align-top">
        <button type="button" onClick={() => setEditingId(null)} className="p-1.5 text-muted-foreground hover:text-muted-foreground rounded bg-background"><X className="w-4 h-4" /></button>
        <button type="button" onClick={() => handleSave(id)} className="p-1.5 text-cyan-600 hover:text-cyan-700 bg-cyan-50 rounded"><Save className="w-4 h-4" /></button>
      </td>
    </>
  )

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Unlinked GPS plates (IMEI not assigned to any master vehicle) */}
      <GlassCard className="p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">ทะเบียน GPS ที่ยังไม่ถูกผูก</h3>
            <p className="text-xs text-muted-foreground">
              {gpsLoading
                ? "กำลังโหลดข้อมูล GPS..."
                : linkableGps.length === 0
                  ? "ไม่มีทะเบียน GPS ที่รอผูก"
                  : `${linkableGps.length} รายการ — ผูกได้จากคอลัมน์ GPS ในตารางด้านล่าง`}
            </p>
          </div>
          <button
            type="button"
            onClick={loadGps}
            disabled={gpsLoading}
            className="text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50"
          >
            รีเฟรช GPS
          </button>
        </div>

        {gpsError && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {gpsError}
          </div>
        )}

        {linkableGps.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {linkableGps.map((g) => (
              <div
                key={g.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-sm font-medium text-amber-800"
                title={`IMEI ${g.imei}`}
              >
                <span className="font-mono">{g.plateNumber}</span>
                <span className="font-mono text-xs font-normal text-amber-700/80">{g.imei}</span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard padding="none">
        <div className="min-w-0 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="min-w-0 px-4 py-3 font-semibold text-muted-foreground">สาขา</th>
                <th className="w-28 px-4 py-3 font-semibold text-muted-foreground">ทะเบียน</th>
                <th className="min-w-0 px-4 py-3 font-semibold text-muted-foreground">ชื่อรถ</th>
                <th className="w-28 px-4 py-3 font-semibold text-muted-foreground">ประเภท</th>
                <th className="w-28 px-4 py-3 font-semibold text-muted-foreground">น้ำหนักรถเปล่า (กก.)</th>
                <th className="w-32 px-4 py-3 font-semibold text-muted-foreground">น้ำหนักรวมสูงสุด (กก.)</th>
                <th className="w-32 px-4 py-3 font-semibold text-muted-foreground">GPS (IMEI)</th>
                <th className="min-w-0 px-4 py-3 font-semibold text-muted-foreground">รายละเอียด</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground w-24">สถานะ</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {editingId === "new" && <tr className="bg-cyan-50/50">{renderForm("new")}</tr>}
              {filtered.map((item) =>
                editingId === item.id ? (
                  <tr key={item.id} className="bg-cyan-50/50">{renderForm(item.id, item.gpsDeviceId)}</tr>
                ) : (
                  <tr key={item.id} className={`hover:bg-muted/60 ${!item.isActive ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 text-muted-foreground">{item.branch.name}</td>
                    <td className="px-4 py-3 font-mono font-medium">{item.plateNumber}</td>
                    <td className="px-4 py-3 text-foreground">{item.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.vehicleType}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.maxWeightKg ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.loadCapacityKg ?? "—"}</td>
                    <td className="px-4 py-3">
                      {item.gpsDeviceId ? (
                        <span className="font-mono text-xs text-foreground">{item.gpsDeviceId}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (linkableGps.length === 0) {
                              alert("ไม่มี IMEI จาก GPS ที่ยังไม่ถูกผูก — ตรวจสอบการตั้งค่า GPS API")
                              return
                            }
                            startEditVehicle(
                              item,
                              linkableGps.length === 1 ? linkableGps[0].id : ""
                            )
                          }}
                          className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-200"
                        >
                          ยังไม่ผูก — คลิกแก้ไขเพื่อผูก
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top max-w-xs"><DetailsDisplay value={item.notes} /></td>
                    <td className="px-4 py-3 align-top"><VehicleStatusBadge status={item.currentStatus as never} /></td>
                    <td className="px-4 py-3 text-right space-x-2 align-top">
                      {item.isActive ? (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditVehicle(item)}
                            className="p-1.5 text-muted-foreground hover:text-cyan-600"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => handleDeactivate(item.id)} className="p-1.5 text-muted-foreground hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={() => handleReactivate(item.id)} className="text-xs text-cyan-600 hover:underline">
                          เปิดใช้งาน
                        </button>
                      )}
                    </td>
                  </tr>
                )
              )}
              {data.length === 0 && editingId !== "new" && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                    ยังไม่มีข้อมูล
                  </td>
                </tr>
              )}
              {data.length > 0 && filtered.length === 0 && editingId !== "new" && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                    ไม่พบรายการที่ตรงกับคำค้น
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
