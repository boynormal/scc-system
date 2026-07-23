"use client"

import { useState, useEffect, useMemo } from "react"
import { Plus, Edit2, Trash2, Save, X, Loader2, Link2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { VehicleStatusBadge } from "@/components/transport/vehicle-status-badge"
import { LinkGpsVehicleModal, type GpsVehicleInput } from "@/components/transport/LinkGpsVehicleModal"
import {
  fetchGpsVehicles,
  filterLinkableGps,
  filterUnlinkedMasterVehicles,
  linkGpsToVehicle,
} from "@/components/transport/gps/gps-link-utils"
import type { GpsVehicleData } from "@/app/api/transport/gps/route"
import { DetailsDisplay, DetailsField } from "@/components/transport/master-data/DetailsField"

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

export function VehiclesTab() {
  const [data, setData] = useState<Vehicle[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm)

  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [gpsVehicles, setGpsVehicles] = useState<GpsVehicleData[]>([])

  const [linkMasterId, setLinkMasterId] = useState("")
  const [linkGpsId, setLinkGpsId] = useState("")
  const [linkSaving, setLinkSaving] = useState(false)
  const [linkCardError, setLinkCardError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalGps, setModalGps] = useState<GpsVehicleInput | null>(null)
  const [modalPreselectVehicleId, setModalPreselectVehicleId] = useState<string | null>(null)

  const unlinkedVehicles = useMemo(
    () => filterUnlinkedMasterVehicles(data),
    [data]
  )

  const linkableGps = useMemo(
    () => filterLinkableGps(gpsVehicles, data),
    [gpsVehicles, data]
  )

  const selectedGpsOption = linkableGps.find((g) => g.id === linkGpsId)
  const editSelectedGps = linkableGps.find((g) => g.id === editForm.linkGpsId)

  const loadGps = async () => {
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
  }

  const loadData = async () => {
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
  }

  useEffect(() => {
    loadData()
  }, [])

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

  const handleLinkFromCard = async () => {
    if (!linkMasterId || !linkGpsId || !selectedGpsOption) {
      setLinkCardError("กรุณาเลือกรถในระบบและทะเบียนจาก GPS")
      return
    }
    setLinkSaving(true)
    setLinkCardError(null)
    try {
      await linkGpsToVehicle(linkMasterId, selectedGpsOption.imei)
      setLinkMasterId("")
      setLinkGpsId("")
      loadData()
    } catch (e) {
      setLinkCardError(e instanceof Error ? e.message : "ผูก GPS ไม่สำเร็จ")
    } finally {
      setLinkSaving(false)
    }
  }

  const openLinkModalForVehicle = (vehicleId: string, gps?: GpsVehicleInput | null) => {
    setModalPreselectVehicleId(vehicleId)
    setModalGps(gps ?? null)
    setModalOpen(true)
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

  const fieldClass = "h-8 w-full rounded-lg border border-slate-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"

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
      <td className="px-4 py-3"><Input value={editForm.plateNumber} onChange={(e) => setEditForm((f) => ({ ...f, plateNumber: e.target.value }))} className="h-8 border-cyan-300" /></td>
      <td className="px-4 py-3"><Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="h-8 border-cyan-300" /></td>
      <td className="px-4 py-3">
        <select value={editForm.vehicleType} onChange={(e) => setEditForm((f) => ({ ...f, vehicleType: e.target.value }))} className={fieldClass}>
          <option value="">-- ประเภทรถ --</option>
          {vehicleTypes.map((t) => (
            <option key={t.id} value={t.name}>{t.name}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3"><Input type="number" min={0} value={editForm.maxWeightKg} onChange={(e) => setEditForm((f) => ({ ...f, maxWeightKg: e.target.value }))} placeholder="น้ำหนักรถเปล่า" className="h-8 border-cyan-300" /></td>
      <td className="px-4 py-3"><Input type="number" min={0} value={editForm.loadCapacityKg} onChange={(e) => setEditForm((f) => ({ ...f, loadCapacityKg: e.target.value }))} placeholder="น้ำหนักรวมสูงสุด" className="h-8 border-cyan-300" /></td>
      <td className="px-4 py-3">
        {itemGpsDeviceId ? (
          <span className="font-mono text-xs text-slate-700">{itemGpsDeviceId}</span>
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
              <p className="text-[10px] text-slate-500 font-mono">IMEI: {editSelectedGps.imei}</p>
            )}
            {id !== "new" && linkableGps.length > 0 && (
              <button
                type="button"
                onClick={() => openLinkModalForVehicle(id)}
                className="inline-flex items-center gap-1 text-[10px] text-cyan-700 underline hover:text-cyan-900"
              >
                <Link2 className="h-3 w-3" /> เปิด modal ผูก...
              </button>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3 align-top min-w-[160px]">
        <DetailsField value={editForm.notes} onChange={(notes) => setEditForm((f) => ({ ...f, notes }))} />
      </td>
      <td className="px-4 py-3 align-top">-</td>
      <td className="px-4 py-3 text-right space-x-2 align-top">
        <button type="button" onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded bg-white"><X className="w-4 h-4" /></button>
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
      {/* GPS link card */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-1">ผูก GPS กับรถ</h3>
        <p className="text-xs text-slate-500 mb-3">เลือกทะเบียนจาก GPS — ระบบจะบันทึก IMEI ให้อัตโนมัติ</p>

        {gpsError && (
          <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            {gpsError}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">รถในระบบ (ยังไม่ผูก GPS)</label>
            <select
              value={linkMasterId}
              onChange={(e) => setLinkMasterId(e.target.value)}
              disabled={gpsLoading}
              className={fieldClass}
            >
              <option value="">-- เลือกรถ --</option>
              {unlinkedVehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.plateNumber} — {v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">ทะเบียนจาก GPS (ยังไม่ผูก IMEI)</label>
            <select
              value={linkGpsId}
              onChange={(e) => setLinkGpsId(e.target.value)}
              disabled={gpsLoading || linkableGps.length === 0}
              className={fieldClass}
            >
              <option value="">-- เลือกทะเบียน GPS --</option>
              {linkableGps.map((g) => (
                <option key={g.id} value={g.id}>{g.plateNumber} · IMEI {g.imei}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedGpsOption && (
          <p className="mt-2 text-xs text-slate-600">
            IMEI ที่จะบันทึก: <span className="font-mono font-medium">{selectedGpsOption.imei}</span>
          </p>
        )}

        {linkCardError && (
          <p className="mt-2 text-xs text-red-600">{linkCardError}</p>
        )}

        <div className="mt-3 flex items-center gap-2">
          <Button
            onClick={handleLinkFromCard}
            disabled={linkSaving || gpsLoading || !linkMasterId || !linkGpsId}
            icon={linkSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          >
            {linkSaving ? "กำลังผูก..." : "ผูก GPS"}
          </Button>
          <button
            type="button"
            onClick={loadGps}
            disabled={gpsLoading}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            รีเฟรชรายการ GPS
          </button>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditingId("new")
            setEditForm({ ...emptyForm, branchId: branches.length === 1 ? branches[0].id : "" })
          }}
          icon={<Plus className="w-4 h-4" />}
        >
          เพิ่มรถ
        </Button>
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[900px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-600">สาขา</th>
                <th className="px-4 py-3 font-semibold text-slate-600 w-28">ทะเบียน</th>
                <th className="px-4 py-3 font-semibold text-slate-600">ชื่อรถ</th>
                <th className="px-4 py-3 font-semibold text-slate-600 w-28">ประเภท</th>
                <th className="px-4 py-3 font-semibold text-slate-600 w-28">น้ำหนักรถเปล่า (กก.)</th>
                <th className="px-4 py-3 font-semibold text-slate-600 w-32">น้ำหนักรวมสูงสุด (กก.)</th>
                <th className="px-4 py-3 font-semibold text-slate-600 w-32">GPS (IMEI)</th>
                <th className="px-4 py-3 font-semibold text-slate-600 min-w-[160px]">รายละเอียด</th>
                <th className="px-4 py-3 font-semibold text-slate-600 w-24">สถานะ</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {editingId === "new" && <tr className="bg-cyan-50/50">{renderForm("new")}</tr>}
              {data.map((item) =>
                editingId === item.id ? (
                  <tr key={item.id} className="bg-cyan-50/50">{renderForm(item.id, item.gpsDeviceId)}</tr>
                ) : (
                  <tr key={item.id} className={`hover:bg-slate-50 ${!item.isActive ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 text-slate-600">{item.branch.name}</td>
                    <td className="px-4 py-3 font-mono font-medium">{item.plateNumber}</td>
                    <td className="px-4 py-3 text-slate-800">{item.name}</td>
                    <td className="px-4 py-3 text-slate-600">{item.vehicleType}</td>
                    <td className="px-4 py-3 text-slate-600">{item.maxWeightKg ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{item.loadCapacityKg ?? "—"}</td>
                    <td className="px-4 py-3">
                      {item.gpsDeviceId ? (
                        <span className="font-mono text-xs text-slate-700">{item.gpsDeviceId}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (linkableGps.length === 0) {
                              alert("ไม่มี IMEI จาก GPS ที่ยังไม่ถูกผูก — ตรวจสอบการตั้งค่า GPS API")
                              return
                            }
                            openLinkModalForVehicle(
                              item.id,
                              linkableGps.length === 1
                                ? { plateNumber: linkableGps[0].plateNumber, imei: linkableGps[0].imei }
                                : null
                            )
                          }}
                          className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-200"
                        >
                          ยังไม่ผูก — คลิกผูก
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
                            onClick={() => {
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
                                linkGpsId: "",
                              })
                            }}
                            className="p-1.5 text-slate-400 hover:text-cyan-600"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => handleDeactivate(item.id)} className="p-1.5 text-slate-400 hover:text-red-600">
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
            </tbody>
          </table>
        </div>
      </Card>

      <LinkGpsVehicleModal
        open={modalOpen}
        gpsVehicle={modalGps}
        gpsVehicles={gpsVehicles}
        preselectedVehicleId={modalPreselectVehicleId}
        masterVehicles={data}
        branches={branches}
        vehicleTypes={vehicleTypes}
        onSuccess={() => {
          setModalOpen(false)
          setModalGps(null)
          setModalPreselectVehicleId(null)
          loadData()
        }}
        onCancel={() => {
          setModalOpen(false)
          setModalGps(null)
          setModalPreselectVehicleId(null)
        }}
      />
    </div>
  )
}
