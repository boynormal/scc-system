"use client"

import { useState, useEffect, useMemo, Fragment, useRef } from "react"
import { Edit2, Trash2, Save, X, Loader2, ChevronDown, ChevronRight } from "lucide-react"
import { GlassButton, GlassCard, GlassInput } from "@/components/glass"
import { includesSearch, isAutoDriverCode } from "@/components/transport/master-data/transport-code-utils"
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

type Props = {
  search?: string
  addRequest?: number
}

export function DriversTab({ search = "", addRequest = 0 }: Props) {
  const [data, setData] = useState<Driver[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm)
  const [migrating, setMigrating] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())

  const MAIN_COL_COUNT = 7

  const filtered = useMemo(
    () =>
      data.filter((item) =>
        includesSearch(
          [
            item.code,
            item.firstName,
            item.lastName,
            item.phone,
            item.branch.name,
            item.assignedVehicle?.plateNumber,
            item.notes,
          ],
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

  // Data columns share width 10 parts: branch 2, firstName 1, lastName 3, phone 2, vehicle 2
  const colBranch = "w-[20%] min-w-0 px-3 py-3"
  const colFirstName = "w-[10%] min-w-0 px-3 py-3"
  const colLastName = "w-[30%] min-w-0 px-3 py-3"
  const colPhone = "w-[20%] min-w-0 px-3 py-3"
  const colVehicle = "w-[20%] min-w-0 px-3 py-3"

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

  const fieldClass =
    "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground dark:border-slate-500 dark:bg-slate-950/55 focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
      <td className="w-10 px-2 py-3 align-top" />
      <td className={`${colBranch} align-top`}>
        <select value={editForm.branchId} onChange={(e) => setEditForm((f) => ({ ...f, branchId: e.target.value, assignedVehicleId: "" }))} className={fieldClass}>
          <option value="">-- สาขา --</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </td>
      <td className={`${colFirstName} align-top`}><GlassInput value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} className="h-8 border-cyan-300" /></td>
      <td className={`${colLastName} align-top`}><GlassInput value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} className="h-8 border-cyan-300" /></td>
      <td className={`${colPhone} align-top`}><GlassInput value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className="h-8 border-cyan-300" /></td>
      <td className={`${colVehicle} align-top`}>
        <select value={editForm.assignedVehicleId} onChange={(e) => setEditForm((f) => ({ ...f, assignedVehicleId: e.target.value }))} className={fieldClass}>
          <option value="">-- ไม่ระบุรถประจำ --</option>
          {branchVehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.plateNumber} — {v.name}</option>
          ))}
        </select>
      </td>
      <td className="w-24 px-3 py-3 text-right align-top space-x-2">
        <button type="button" onClick={() => setEditingId(null)} className="p-1.5 text-muted-foreground hover:text-muted-foreground rounded bg-background"><X className="w-4 h-4" /></button>
        <button type="button" onClick={() => handleSave(id)} className="p-1.5 text-cyan-600 hover:text-cyan-700 bg-cyan-50 rounded"><Save className="w-4 h-4" /></button>
      </td>
    </>
  )

  const renderFormSubRow = () => (
    <td colSpan={MAIN_COL_COUNT} className="border-t border-cyan-100 bg-cyan-50/30 px-4 py-3">
      <div className="grid gap-4 pl-8 sm:grid-cols-3">
        <div className="min-w-0">
          <p className="mb-2 text-sm font-semibold text-foreground">ใบขับขี่</p>
          <MultiSelectCheckbox
            options={DRIVER_LICENSE_TYPES}
            value={editForm.licenseTypes}
            onChange={(licenseTypes) => setEditForm((f) => ({ ...f, licenseTypes }))}
            className="min-w-0 w-full"
          />
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-sm font-semibold text-foreground">ประเภทรถที่ขับได้</p>
          <MultiSelectCheckbox
            options={DRIVER_DRIVABLE_VEHICLE_TYPES}
            value={editForm.drivableVehicleTypes}
            onChange={(drivableVehicleTypes) => setEditForm((f) => ({ ...f, drivableVehicleTypes }))}
            className="min-w-0 w-full"
          />
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-sm font-semibold text-foreground">รายละเอียด</p>
          <DetailsField
            value={editForm.notes}
            onChange={(notes) => setEditForm((f) => ({ ...f, notes }))}
            className="h-44 min-h-44 resize-y"
          />
        </div>
      </div>
    </td>
  )

  const renderViewSubRow = (item: Driver) => (
    <td colSpan={MAIN_COL_COUNT} className="border-t border-border bg-muted/80 px-4 py-3">
      <div className="grid gap-4 pl-8 sm:grid-cols-3">
        <div className="min-w-0">
          <p className="mb-1.5 text-sm font-semibold text-foreground">ใบขับขี่</p>
          <MultiSelectDisplay value={parseStringArray(item.licenseTypes)} />
        </div>
        <div className="min-w-0">
          <p className="mb-1.5 text-sm font-semibold text-foreground">ประเภทรถที่ขับได้</p>
          <MultiSelectDisplay value={parseStringArray(item.drivableVehicleTypes)} />
        </div>
        <div className="min-w-0">
          <p className="mb-1.5 text-sm font-semibold text-foreground">รายละเอียด</p>
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
          <GlassButton
            variant="outline"
            size="sm"
            disabled={migrating}
            onClick={handleMigrateLegacyCodes}
          >
            {migrating ? "กำลังปรับรหัส..." : "ปรับรหัสเป็นรูปแบบใหม่"}
          </GlassButton>
        </div>
      )}
      <GlassCard padding="none">
        <div className="min-w-0 overflow-hidden">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-10" />
              <col className="w-[20%]" />
              <col className="w-[10%]" />
              <col className="w-[30%]" />
              <col className="w-[20%]" />
              <col className="w-[20%]" />
              <col className="w-24" />
            </colgroup>
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="w-10 px-2 py-3"></th>
                <th className={`${colBranch} font-semibold text-muted-foreground`}>สาขา</th>
                <th className={`${colFirstName} font-semibold text-muted-foreground`}>ชื่อ</th>
                <th className={`${colLastName} font-semibold text-muted-foreground`}>นามสกุล</th>
                <th className={`${colPhone} font-semibold text-muted-foreground`}>โทรศัพท์</th>
                <th className={`${colVehicle} font-semibold text-muted-foreground`} title="รถที่ใช้งานประจำของคนขับ">รถประจำ</th>
                <th className="w-24 px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {editingId === "new" && (
                <>
                  <tr className="bg-cyan-50/50">{renderFormMain("new")}</tr>
                  <tr className="bg-cyan-50/50">{renderFormSubRow()}</tr>
                </>
              )}
              {filtered.map((item) =>
                editingId === item.id ? (
                  <Fragment key={item.id}>
                    <tr className="bg-cyan-50/50">{renderFormMain(item.id)}</tr>
                    <tr className="bg-cyan-50/50">{renderFormSubRow()}</tr>
                  </Fragment>
                ) : (
                  <Fragment key={item.id}>
                    <tr
                      key={item.id}
                      className={`border-t border-border hover:bg-muted/60 ${!item.isActive ? "opacity-50" : ""}`}
                    >
                      <td className="w-10 px-2 py-3 align-top">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(item.id)}
                          className="p-1 text-muted-foreground hover:text-muted-foreground rounded"
                          aria-label={isExpanded(item.id) ? "หุบรายละเอียด" : "ขยายรายละเอียด"}
                        >
                          {isExpanded(item.id) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className={`${colBranch} truncate align-top text-muted-foreground`} title={item.branch.name}>{item.branch.name}</td>
                      <td className={`${colFirstName} truncate align-top`}>{item.firstName}</td>
                      <td className={`${colLastName} truncate align-top`}>{item.lastName}</td>
                      <td className={`${colPhone} whitespace-nowrap align-top text-muted-foreground`}>{item.phone ?? "—"}</td>
                      <td className={`${colVehicle} truncate align-top text-muted-foreground`} title={item.assignedVehicle?.plateNumber ?? undefined}>{item.assignedVehicle?.plateNumber ?? "—"}</td>
                      <td className="w-24 space-x-2 px-3 py-3 text-right align-top">
                        {item.isActive ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(item.id)
                                setEditForm(driverToForm(item))
                              }}
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
                    {isExpanded(item.id) && (
                      <tr className={`${!item.isActive ? "opacity-50" : ""}`}>
                        {renderViewSubRow(item)}
                      </tr>
                    )}
                  </Fragment>
                )
              )}
              {data.length === 0 && editingId !== "new" && (
                <tr>
                  <td colSpan={MAIN_COL_COUNT} className="px-4 py-10 text-center text-muted-foreground">
                    ยังไม่มีข้อมูล
                  </td>
                </tr>
              )}
              {data.length > 0 && filtered.length === 0 && editingId !== "new" && (
                <tr>
                  <td colSpan={MAIN_COL_COUNT} className="px-4 py-10 text-center text-muted-foreground">
                    ไม่พบรายการที่ตรงกับคำค้น
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  )
}
