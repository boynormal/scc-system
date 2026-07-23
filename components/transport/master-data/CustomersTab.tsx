"use client"

import { useState, useEffect, useMemo } from "react"
import { Plus, Edit2, Trash2, Save, X, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { isAutoCustomerCode } from "@/components/transport/master-data/transport-code-utils"
import { DetailsDisplay, DetailsField } from "@/components/transport/master-data/DetailsField"
import {
  CustomerLocationDisplay,
  CustomerLocationField,
} from "@/components/transport/master-data/CustomerLocationField"
import {
  decimalToNumber,
  formatLatLng,
  parseLatLngInput,
} from "@/shared/transport/coordinates"

type Customer = {
  id: string
  code: string | null
  name: string
  address: string | null
  latitude: unknown
  longitude: unknown
  contactName: string | null
  phone: string | null
  details: string | null
  isActive: boolean
}

type FormState = {
  name: string
  address: string
  contactName: string
  phone: string
  details: string
  locationInput: string
}

const emptyForm: FormState = {
  name: "",
  address: "",
  contactName: "",
  phone: "",
  details: "",
  locationInput: "",
}
const API = "/api/transport/master-data/customers"

function optionalText(value: string, clearOnEmpty: boolean) {
  const trimmed = value.trim()
  if (!trimmed) return clearOnEmpty ? null : undefined
  return trimmed
}

function buildCustomerPayload(form: FormState, isUpdate: boolean) {
  return {
    name: form.name.trim(),
    address: optionalText(form.address, isUpdate),
    contactName: optionalText(form.contactName, isUpdate),
    phone: optionalText(form.phone, isUpdate),
    details: optionalText(form.details, isUpdate),
    ...locationPayload(form.locationInput),
  }
}

function customerToForm(item: Customer): FormState {
  return {
    name: item.name,
    address: item.address ?? "",
    contactName: item.contactName ?? "",
    phone: item.phone ?? "",
    details: item.details ?? "",
    locationInput: formatLatLng(decimalToNumber(item.latitude), decimalToNumber(item.longitude)),
  }
}

function locationPayload(locationInput: string) {
  const parsed = parseLatLngInput(locationInput)
  if (!parsed) {
    return { latitude: null, longitude: null }
  }
  return { latitude: parsed.lat, longitude: parsed.lng }
}

function CustomerFormRows({
  formKey,
  form,
  setForm,
  onCancel,
  onSave,
}: {
  formKey: string
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <>
      <tr className="bg-cyan-50/50">
        <td className="px-4 py-3">
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="ชื่อลูกค้า/ปลายทาง *"
            className="h-8 border-cyan-300"
          />
        </td>
        <td className="px-4 py-3">
          <Input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="ที่อยู่"
            className="h-8 border-cyan-300"
          />
        </td>
        <td className="px-4 py-3 align-top text-slate-400 text-xs">กำหนดด้านล่าง</td>
        <td className="px-4 py-3">
          <Input
            value={form.contactName}
            onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
            placeholder="ผู้ติดต่อ"
            className="h-8 border-cyan-300"
          />
        </td>
        <td className="px-4 py-3 align-top">
          <Input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="เบอร์โทร"
            className="h-8 border-cyan-300"
          />
        </td>
        <td className="px-4 py-3 align-top min-w-[160px]">
          <DetailsField value={form.details} onChange={(details) => setForm((f) => ({ ...f, details }))} />
        </td>
        <td className="px-4 py-3 align-top">-</td>
        <td className="px-4 py-3 text-right space-x-2 align-top">
          <button type="button" onClick={onCancel} className="p-1.5 text-slate-400 hover:text-slate-600 rounded bg-white">
            <X className="w-4 h-4" />
          </button>
          <button type="button" onClick={onSave} className="p-1.5 text-cyan-600 hover:text-cyan-700 bg-cyan-50 rounded">
            <Save className="w-4 h-4" />
          </button>
        </td>
      </tr>
      <tr className="bg-cyan-50/30">
        <td colSpan={8} className="px-4 py-3">
          <CustomerLocationField
            key={formKey}
            value={form.locationInput}
            onChange={(locationInput) => setForm((f) => ({ ...f, locationInput }))}
          />
        </td>
      </tr>
    </>
  )
}

export function CustomersTab() {
  const [data, setData] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm)
  const [migrating, setMigrating] = useState(false)

  const legacyCount = useMemo(() => data.filter((c) => !isAutoCustomerCode(c.code)).length, [data])

  const loadData = async () => {
    setLoading(true)
    const res = await fetch(API)
    const json = await res.json()
    setData(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSave = async (id?: string) => {
    if (!editForm.name.trim()) return alert("กรุณากรอกชื่อลูกค้า/ปลายทาง")
    if (editForm.locationInput.trim() && !parseLatLngInput(editForm.locationInput)) {
      return alert("รูปแบบพิกัดไม่ถูกต้อง — ใช้ lat, lng เช่น 13.610387, 100.539879")
    }

    const isUpdate = id !== "new"
    const payload = buildCustomerPayload(editForm, isUpdate)

    const res = await fetch(isUpdate ? `${API}/${id}` : API, {
      method: isUpdate ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      setEditingId(null)
      setEditForm(emptyForm)
      loadData()
    } else {
      const b = await res.json()
      alert(typeof b.error === "string" ? b.error : b.error?.message ?? "เกิดข้อผิดพลาด")
    }
  }

  const handleDeactivate = async (id: string) => {
    if (!confirm("ปิดใช้งานลูกค้านี้?")) return
    const res = await fetch(`${API}/${id}`, { method: "DELETE" })
    if (res.ok) loadData()
  }

  const handleReactivate = async (id: string) => {
    const res = await fetch(`${API}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    })
    if (res.ok) loadData()
  }

  const handleMigrateLegacyCodes = async () => {
    if (!confirm(`ปรับรหัสลูกค้า/ปลายทาง ${legacyCount} รายการให้เป็นรูปแบบ CUST-YYYY-00001?`)) return
    setMigrating(true)
    try {
      const res = await fetch("/api/transport/master-data/migrate-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "customers" }),
      })
      if (res.ok) {
        const json = await res.json()
        alert(`ปรับรหัสสำเร็จ ${json.data?.customers ?? 0} รายการ`)
        loadData()
      } else {
        const b = await res.json()
        alert(typeof b.error === "string" ? b.error : b.error?.message ?? "ปรับรหัสไม่สำเร็จ")
      }
    } finally {
      setMigrating(false)
    }
  }

  const startEdit = (item: Customer) => {
    setEditingId(item.id)
    setEditForm(customerToForm(item))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm(emptyForm)
  }

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
            มีลูกค้า/ปลายทาง <strong>{legacyCount}</strong> รายการที่ใช้รหัสแบบเก่า (ไม่ตรงรูปแบบ CUST-YYYY-00001)
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
        <Button onClick={() => { setEditingId("new"); setEditForm(emptyForm) }} icon={<Plus className="w-4 h-4" />}>
          เพิ่มลูกค้า/ปลายทาง
        </Button>
      </div>
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[960px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-600">ชื่อลูกค้า/ปลายทาง</th>
                <th className="px-4 py-3 font-semibold text-slate-600">ที่อยู่</th>
                <th className="px-4 py-3 font-semibold text-slate-600 w-36">พิกัด</th>
                <th className="px-4 py-3 font-semibold text-slate-600 w-32">ผู้ติดต่อ</th>
                <th className="px-4 py-3 font-semibold text-slate-600 w-28">เบอร์โทร</th>
                <th className="px-4 py-3 font-semibold text-slate-600 min-w-[160px]">รายละเอียด</th>
                <th className="px-4 py-3 font-semibold text-slate-600 w-20">สถานะ</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {editingId === "new" && (
                <CustomerFormRows
                  formKey="new"
                  form={editForm}
                  setForm={setEditForm}
                  onCancel={cancelEdit}
                  onSave={() => handleSave("new")}
                />
              )}
              {data.map((item) =>
                editingId === item.id ? (
                  <CustomerFormRows
                    key={item.id}
                    formKey={item.id}
                    form={editForm}
                    setForm={setEditForm}
                    onCancel={cancelEdit}
                    onSave={() => handleSave(item.id)}
                  />
                ) : (
                  <tr key={item.id} className={`hover:bg-slate-50 ${!item.isActive ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={item.address ?? ""}>
                      {item.address ?? "—"}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <CustomerLocationDisplay
                        latitude={decimalToNumber(item.latitude)}
                        longitude={decimalToNumber(item.longitude)}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.contactName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600 align-top">{item.phone ?? "—"}</td>
                    <td className="px-4 py-3 align-top max-w-xs">
                      <DetailsDisplay value={item.details} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${item.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
                      >
                        {item.isActive ? "ใช้งาน" : "ปิด"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {item.isActive ? (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="p-1.5 text-slate-400 hover:text-cyan-600"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeactivate(item.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReactivate(item.id)}
                          className="text-xs text-cyan-600 hover:underline"
                        >
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
    </div>
  )
}
