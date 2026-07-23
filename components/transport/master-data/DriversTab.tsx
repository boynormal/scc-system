"use client"

import { useState, useEffect, useMemo, Fragment } from "react"
import { Plus, Edit2, Trash2, Save, X, Loader2, ChevronDown, ChevronRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { isAutoDriverCode } from "@/components/transport/master-data/transport-code-utils"
import { DetailsDisplay, DetailsField } from "@/components/transport/master-data/DetailsField"
import {
  MultiSelectCheckbox,
  MultiSelectDisplay,
  parseStringArray,
} from "@/components/transport/master-data/MultiSelectCheckbox"
import {
  DRIVER_DRIVABLE_VEHICLE_TYPES,
  DRIVER_LICENSE_TYPES,
} from "@/modules/transport/application/driver-options"

type Branch = { id: string; name: string }
type Vehicle = { id: string; plateNumber: string; name: string; branchId: string }
type Driver = {
  id: string
  branchId: string
  code: string
  firstName: string
  lastName: string
  phone: string | null
  licenseTypes: unknown
  drivableVehicleTypes: unknown
  assignedVehicleId: string | null
  notes: string | null
  currentStatus: string
  isActive: boolean
  branch: { id: string; name: string }
  assignedVehicle: { id: string; plateNumber: string; name: string } | null
}

type FormState = {
  branchId: string
  firstName: string
  lastName: string
  phone: string
  licenseTypes: string[]
  drivableVehicleTypes: string[]
  assignedVehicleId: string
  notes: string
}

const emptyForm: FormState = {
  branchId: "",
  firstName: "",
  lastName: "",
  phone: "",
  licenseTypes: [],
  drivableVehicleTypes: [],
  assignedVehicleId: "",
  notes: "",
}

export function DriversTab() {
  const [data, setData] = useState<Driver[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm)
  const [migrating, setMigrating] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())

  const MAIN_COL_COUNT = 8

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isExpanded = (id: string) => expandedIds.has(id)

  const legacyCount = useMemo(() => data.filter((d) => !isAutoDriverCode(d.code)).length, [data])

  const loadData = async () => {
    setLoading(true)
    const [driversRes, branchesRes, vehiclesRes] = await Promise.all([
      fetch("/api/transport/drivers?includeInactive=true"),
      fetch("/api/settings/branches"),
      fetch("/api/transport/vehicles"),
    ])
    const [driversJson, branchesJson, vehiclesJson] = await Promise.all([
      driversRes.json(),
      branchesRes.json(),
      vehiclesRes.json(),
    ])
    setData(driversJson.data ?? [])
    setBranches(branchesJson.data ?? [])
    setVehicles(vehiclesJson.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSave = async (id?: string) => {
    if (!editForm.branchId || !editForm.firstName || !editForm.lastName) {
      return alert("กรุณากรอกสาขา ชื่อ และนามสกุล")
    }
    const payload = {
      branchId: editForm.branchId,
      firstName: editForm.firstName.trim(),
      lastName: editForm.lastName.trim(),
      phone: editForm.phone.trim() || undefined,
      licenseTypes: editForm.licenseTypes,
      drivableVehicleTypes: editForm.drivableVehicleTypes,
      assignedVehicleId: editForm.assignedVehicleId || undefined,
      notes: editForm.notes.trim() || undefined,
    }

    const res = await fetch(id === "new" ? "/api/transport/drivers" : `/api/transport/drivers/${id}`, {
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
    if (!confirm("ปิดใช้งานคนขับคนนี้?")) return
    const res = await fetch(`/api/transport/drivers/${id}`, { method: "DELETE" })
    if (res.ok) loadData()
  }

  const handleReactivate = async (id: string) => {
    const res = await fetch(`/api/transport/drivers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    })
    if (res.ok) loadData()
    else {
      const b = await res.json()
      alert(typeof b.error === "string" ? b.error : b.error?.message ?? "เปิดใช้งานไม่สำเร็จ")
    }
  }

  const handleMigrateLegacyCodes = async () => {
    if (!confirm(`ปรับรหัสคนขับ ${legacyCount} รายการให้เป็นรูปแบบ DRV-YYYY-00001?`)) return
    setMigrating(true)
    try {
      const res = await fetch("/api/transport/master-data/migrate-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "drivers" }),
      })
      if (res.ok) {
        const json = await res.json()
        alert(`ปรับรหัสสำเร็จ ${json.data?.drivers ?? 0} รายการ`)
        loadData()
      } else {
        const b = await res.json()
        alert(typeof b.error === "string" ? b.error : b.error?.message ?? "ปรับรหัสไม่สำเร็จ")
      }
    } finally {
      setMigrating(false)
    }
  }

  const fieldClass = "h-8 w-full rounded-lg border border-slate-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
  const branchVehicles = vehicles.filter(
    (v) => !editForm.branchId || v.branchId === editForm.branchId
  )

  const driverToForm = (item: Driver): FormState => ({
    branchId: item.branchId,
    firstName: item.firstName,
    lastName: item.lastName,
    phone: item.phone ?? "",
    licenseTypes: parseStringArray(item.licenseTypes),
    drivableVehicleTypes: parseStringArray(item.drivableVehicleTypes),
    assignedVehicleId: item.assignedVehicleId ?? "",
    notes: item.notes ?? "",
  })

  const renderFormMain = (id: string) => (
    <>
      <td className="px-2 py-3 align-top w-10" />
      <td className="px-4 py-3 align-top">
        <select value={editForm.branchId} onChange={(e) => setEditForm((f) => ({ ...f, branchId: e.target.value, assignedVehicleId: "" }))} className={fieldClass}>
          <option value="">-- สาขา --</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 align-top"><Input value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} className="h-8 border-cyan-300" /></td>
      <td className="px-4 py-3 align-top"><Input value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} className="h-8 border-cyan-300" /></td>
      <td className="px-4 py-3 align-top"><Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className="h-8 border-cyan-300" /></td>
      <td className="px-4 py-3 align-top">
        <select value={editForm.assignedVehicleId} onChange={(e) => setEditForm((f) => ({ ...f, assignedVehicleId: e.target.value }))} className={fieldClass}>
          <option value="">-- ไม่ระบุรถประจำ --</option>
          {branchVehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.plateNumber} — {v.name}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 align-top">
        <MultiSelectCheckbox
          options={DRIVER_LICENSE_TYPES}
          value={editForm.licenseTypes}
          onChange={(licenseTypes) => setEditForm((f) => ({ ...f, licenseTypes }))}
        />
      </td>
      <td className="px-4 py-3 text-right space-x-2 align-top">
        <button type="button" onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded bg-white"><X className="w-4 h-4" /></button>
        <button type="button" onClick={() => handleSave(id)} className="p-1.5 text-cyan-600 hover:text-cyan-700 bg-cyan-50 rounded"><Save className="w-4 h-4" /></button>
      </td>
    </>
  )

  const renderFormSubRow = () => (
    <td colSpan={MAIN_COL_COUNT} className="px-4 py-3 bg-cyan-50/30 border-t border-cyan-100">
      <div className="grid sm:grid-cols-2 gap-4 pl-8">
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">ประเภทรถที่ขับได้</p>
          <MultiSelectCheckbox
            options={DRIVER_DRIVABLE_VEHICLE_TYPES}
            value={editForm.drivableVehicleTypes}
            onChange={(drivableVehicleTypes) => setEditForm((f) => ({ ...f, drivableVehicleTypes }))}
            className="min-w-0 w-full"
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">รายละเอียด</p>
          <DetailsField value={editForm.notes} onChange={(notes) => setEditForm((f) => ({ ...f, notes }))} />
        </div>
      </div>
    </td>
  )

  const renderViewSubRow = (item: Driver) => (
    <td colSpan={MAIN_COL_COUNT} className="px-4 py-3 bg-slate-50/80 border-t border-slate-100">
      <div className="grid sm:grid-cols-2 gap-4 pl-8">
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1.5">ประเภทรถที่ขับได้</p>
          <MultiSelectDisplay value={parseStringArray(item.drivableVehicleTypes)} />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1.5">รายละเอียด</p>
          <DetailsDisplay value={item.notes} expanded />
        </div>
      </div>
    </td>
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
      {legacyCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>
            มีคนขับ <strong>{legacyCount}</strong> รายการที่ใช้รหัสแบบเก่า (ไม่ตรงรูปแบบ DRV-YYYY-00001)
          </p>
          <Button
            variant="secondary"
            size="sm"
            disabled={migrating}
            onClick={handleMigrateLegacyCodes}
          >
            {migrating ? "กำลังปรับรหัส..." : "ปรับรหัสเป็นรูปแบบใหม่"}
          </Button>
        </div>
      )}
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditingId("new")
            setEditForm({ ...emptyForm, branchId: branches.length === 1 ? branches[0].id : "" })
          }}
          icon={<Plus className="w-4 h-4" />}
        >
          เพิ่มคนขับ
        </Button>
      </div>
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-2 py-3 w-10"></th>
                <th className="px-4 py-3 font-semibold text-slate-600">สาขา</th>
                <th className="px-4 py-3 font-semibold text-slate-600">ชื่อ</th>
                <th className="px-4 py-3 font-semibold text-slate-600">นามสกุล</th>
                <th className="px-4 py-3 font-semibold text-slate-600 w-28">โทรศัพท์</th>
                <th className="px-4 py-3 font-semibold text-slate-600 w-36" title="รถที่ใช้งานประจำของคนขับ">รถประจำ</th>
                <th className="px-4 py-3 font-semibold text-slate-600">ใบขับขี่</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {editingId === "new" && (
                <>
                  <tr className="bg-cyan-50/50">{renderFormMain("new")}</tr>
                  <tr className="bg-cyan-50/50">{renderFormSubRow()}</tr>
                </>
              )}
              {data.map((item) =>
                editingId === item.id ? (
                  <Fragment key={item.id}>
                    <tr className="bg-cyan-50/50">{renderFormMain(item.id)}</tr>
                    <tr className="bg-cyan-50/50">{renderFormSubRow()}</tr>
                  </Fragment>
                ) : (
                  <Fragment key={item.id}>
                    <tr
                      key={item.id}
                      className={`border-t border-slate-100 hover:bg-slate-50 ${!item.isActive ? "opacity-50" : ""}`}
                    >
                      <td className="px-2 py-3 align-top w-10">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(item.id)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded"
                          aria-label={isExpanded(item.id) ? "หุบรายละเอียด" : "ขยายรายละเอียด"}
                        >
                          {isExpanded(item.id) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-600 align-top">{item.branch.name}</td>
                      <td className="px-4 py-3 align-top">{item.firstName}</td>
                      <td className="px-4 py-3 align-top">{item.lastName}</td>
                      <td className="px-4 py-3 text-slate-600 align-top">{item.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600 align-top">{item.assignedVehicle?.plateNumber ?? "—"}</td>
                      <td className="px-4 py-3 align-top">
                        <MultiSelectDisplay value={parseStringArray(item.licenseTypes)} />
                      </td>
                      <td className="px-4 py-3 text-right space-x-2 align-top">
                        {item.isActive ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(item.id)
                                setEditForm(driverToForm(item))
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
                    {isExpanded(item.id) && (
                      <tr className={`${!item.isActive ? "opacity-50" : ""}`}>
                        {renderViewSubRow(item)}
                      </tr>
                    )}
                  </Fragment>
                )
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
