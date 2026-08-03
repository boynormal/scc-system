"use client"

import { useState, useEffect, Fragment, useMemo, useRef } from "react"
import { Edit2, Trash2, Save, X, Loader2, RotateCcw, Plus } from "lucide-react"
import { GlassCard, GlassInput } from "@/components/glass"
import { DetailsDisplay, DetailsField } from "@/components/transport/master-data/DetailsField"
import { includesSearch } from "@/components/transport/master-data/transport-code-utils"
import { useTypeConfirm } from "@/components/ui/type-confirm"
import { WheelLayoutDiagram } from "@/components/transport/WheelLayoutDiagram"
import {
  VEHICLE_WHEEL_COUNTS,
  getDefaultWheelLayout,
  type VehicleWheelCount,
  type WheelLayout,
} from "@/modules/transport/application/vehicle-wheel-layouts"

type VehicleTypeItem = {
  id: string
  name: string
  details: string | null
  sortOrder: number
  isActive: boolean
  wheelCount: number | null
  wheelLayout: WheelLayout | null
}

type FormState = {
  name: string
  details: string
  sortOrder: string
  wheelCount: string
  wheelLayout: WheelLayout
}

const API_PATH = "/api/transport/master-data/vehicle-types"

function emptyForm(sortOrder = "1"): FormState {
  const wheelCount: VehicleWheelCount = 6
  return {
    name: "",
    details: "",
    sortOrder,
    wheelCount: String(wheelCount),
    wheelLayout: getDefaultWheelLayout(wheelCount),
  }
}

function parseLayout(value: unknown, wheelCount: number | null): WheelLayout {
  if (Array.isArray(value) && value.length > 0) {
    return value.map((axle) =>
      Array.isArray(axle) ? axle.map((n) => Number(n)).filter((n) => Number.isFinite(n)) : []
    )
  }
  if (wheelCount && VEHICLE_WHEEL_COUNTS.includes(wheelCount as VehicleWheelCount)) {
    return getDefaultWheelLayout(wheelCount as VehicleWheelCount)
  }
  return getDefaultWheelLayout(6)
}

function renumberLayout(axleSizes: number[]): WheelLayout {
  let n = 1
  return axleSizes.map((size) => {
    const axle: number[] = []
    for (let i = 0; i < Math.max(1, size); i++) {
      axle.push(n++)
    }
    return axle
  })
}

type Props = {
  search?: string
  addRequest?: number
}

export function VehicleTypesTab({ search = "", addRequest = 0 }: Props) {
  const confirmType = useTypeConfirm()
  const [data, setData] = useState<VehicleTypeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm())
  const filtered = useMemo(
    () => data.filter((item) => includesSearch([item.name, item.details], search)),
    [data, search]
  )

  const lastAddRequest = useRef(0)
  useEffect(() => {
    if (!addRequest || addRequest === lastAddRequest.current) return
    lastAddRequest.current = addRequest
    setEditingId("new")
    setEditForm(emptyForm(String(data.length + 1)))
  }, [addRequest, data.length])

  const loadData = async () => {
    setLoading(true)
    const res = await fetch(API_PATH)
    const json = await res.json()
    setData(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const setWheelCount = (raw: string) => {
    const count = Number(raw) as VehicleWheelCount
    if (!VEHICLE_WHEEL_COUNTS.includes(count)) {
      setEditForm((f) => ({ ...f, wheelCount: raw }))
      return
    }
    setEditForm((f) => ({
      ...f,
      wheelCount: raw,
      wheelLayout: getDefaultWheelLayout(count),
    }))
  }

  const resetDefaultLayout = () => {
    const count = Number(editForm.wheelCount) as VehicleWheelCount
    if (!VEHICLE_WHEEL_COUNTS.includes(count)) return
    setEditForm((f) => ({ ...f, wheelLayout: getDefaultWheelLayout(count) }))
  }

  const updateAxleSize = (axleIdx: number, size: number) => {
    setEditForm((f) => {
      const sizes = f.wheelLayout.map((axle, i) => (i === axleIdx ? Math.max(1, size) : axle.length))
      return { ...f, wheelLayout: renumberLayout(sizes) }
    })
  }

  const addAxle = () => {
    setEditForm((f) => {
      const sizes = [...f.wheelLayout.map((a) => a.length), 2]
      return { ...f, wheelLayout: renumberLayout(sizes) }
    })
  }

  const removeAxle = (axleIdx: number) => {
    setEditForm((f) => {
      if (f.wheelLayout.length <= 1) return f
      const sizes = f.wheelLayout.filter((_, i) => i !== axleIdx).map((a) => a.length)
      return { ...f, wheelLayout: renumberLayout(sizes) }
    })
  }

  const handleSave = async (id?: string) => {
    if (!editForm.name.trim()) return alert("กรุณากรอกประเภทรถ")
    const wheelCount = Number(editForm.wheelCount)
    if (!VEHICLE_WHEEL_COUNTS.includes(wheelCount as VehicleWheelCount)) {
      return alert("กรุณาเลือกจำนวนล้อ")
    }
    const flatCount = editForm.wheelLayout.flat().length
    if (flatCount !== wheelCount) {
      return alert(`แผนผังต้องมีตำแหน่งครบ ${wheelCount} ล้อ (ตอนนี้มี ${flatCount})`)
    }

    const payload = {
      name: editForm.name.trim(),
      details: editForm.details.trim() || undefined,
      sortOrder: Number(editForm.sortOrder) || 0,
      wheelCount,
      wheelLayout: editForm.wheelLayout,
    }

    const res =
      id === "new"
        ? await fetch(API_PATH, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`${API_PATH}/${id}`, {
            method: "PATCH",
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
    const ok = await confirmType({ message: "ปิดใช้งานรายการนี้?" })
    if (!ok) return
    const res = await fetch(`${API_PATH}/${id}`, { method: "DELETE" })
    if (res.ok) loadData()
    else {
      const b = await res.json()
      alert(typeof b.error === "string" ? b.error : b.error?.message ?? "เกิดข้อผิดพลาด")
    }
  }

  const handleReactivate = async (item: VehicleTypeItem) => {
    const res = await fetch(`${API_PATH}/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    })
    if (res.ok) loadData()
  }

  const startEdit = (item: VehicleTypeItem) => {
    setEditingId(item.id)
    setEditForm({
      name: item.name,
      details: item.details ?? "",
      sortOrder: String(item.sortOrder),
      wheelCount: String(item.wheelCount ?? 6),
      wheelLayout: parseLayout(item.wheelLayout, item.wheelCount),
    })
  }

  const renderEditor = (id: string) => (
    <tr className="bg-cyan-50/50">
      <td className="px-4 py-3 align-top" colSpan={6}>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">ลำดับ</label>
                <GlassInput
                  type="number"
                  min={0}
                  value={editForm.sortOrder}
                  onChange={(e) => setEditForm((f) => ({ ...f, sortOrder: e.target.value }))}
                  className="h-8"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-muted-foreground">ประเภทรถ *</label>
                <GlassInput
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="ประเภทรถ *"
                  className="h-8"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">จำนวนล้อ *</label>
                <select
                  value={editForm.wheelCount}
                  onChange={(e) => setWheelCount(e.target.value)}
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground dark:border-slate-500 dark:bg-slate-950/55"
                >
                  {VEHICLE_WHEEL_COUNTS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">รายละเอียด</label>
              <DetailsField
                value={editForm.details}
                onChange={(details) => setEditForm((f) => ({ ...f, details }))}
              />
            </div>
            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">แผนผังตำแหน่งล้อ</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={resetDefaultLayout}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-cyan-700 hover:bg-cyan-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    ใช้ค่าเริ่มต้น
                  </button>
                  <button
                    type="button"
                    onClick={addAxle}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    เพิ่มเพลา
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {editForm.wheelLayout.map((axle, axleIdx) => (
                  <div key={`edit-axle-${axleIdx}`} className="flex flex-wrap items-center gap-2">
                    <span className="w-16 text-xs text-muted-foreground">เพลา {axleIdx + 1}</span>
                    <GlassInput
                      type="number"
                      min={1}
                      max={8}
                      value={String(axle.length)}
                      onChange={(e) => updateAxleSize(axleIdx, Number(e.target.value) || 1)}
                      className="h-8 w-20"
                    />
                    <span className="text-xs text-muted-foreground">
                      ตำแหน่ง: {axle.join(", ")}
                    </span>
                    {editForm.wheelLayout.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAxle(axleIdx)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        ลบเพลา
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                รวม {editForm.wheelLayout.flat().length} / {editForm.wheelCount} ล้อ — เปลี่ยนจำนวนล้อต่อเพลาแล้วระบบจะจัดเลขตำแหน่งใหม่ 1..N
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => handleSave(id)}
                className="inline-flex items-center gap-1 rounded-md bg-cyan-600 px-3 py-1.5 text-sm text-white hover:bg-cyan-700"
              >
                <Save className="h-4 w-4" />
                บันทึก
              </button>
            </div>
          </div>
          <WheelLayoutDiagram layout={editForm.wheelLayout} compact />
        </div>
      </td>
    </tr>
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
      <GlassCard padding="none">
        <div className="min-w-0 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="w-20 px-4 py-3 font-semibold text-muted-foreground">ลำดับ</th>
                <th className="min-w-0 px-4 py-3 font-semibold text-muted-foreground">ประเภทรถ</th>
                <th className="w-24 px-4 py-3 font-semibold text-muted-foreground">จำนวนล้อ</th>
                <th className="min-w-0 px-4 py-3 font-semibold text-muted-foreground">รายละเอียด</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground w-24">สถานะ</th>
                <th className="px-4 py-3 w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {editingId === "new" && renderEditor("new")}
              {filtered.map((item) =>
                editingId === item.id ? (
                  <Fragment key={item.id}>{renderEditor(item.id)}</Fragment>
                ) : (
                  <tr
                    key={item.id}
                    className={`hover:bg-muted/60 transition-colors ${!item.isActive ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3 text-muted-foreground align-top">{item.sortOrder}</td>
                    <td className="px-4 py-3 font-medium text-foreground align-top">{item.name}</td>
                    <td className="px-4 py-3 align-top">{item.wheelCount ?? "—"}</td>
                    <td className="px-4 py-3 align-top max-w-xs">
                      <DetailsDisplay value={item.details} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          item.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.isActive ? "ใช้งาน" : "ปิด"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 align-top">
                      {item.isActive ? (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="p-1.5 text-muted-foreground hover:text-cyan-600 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeactivate(item.id)}
                            className="p-1.5 text-muted-foreground hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReactivate(item)}
                          className="text-xs text-cyan-600 hover:underline"
                        >
                          เปิดใช้งาน
                        </button>
                      )}
                    </td>
                  </tr>
                )
              )}
              {data.length === 0 && editingId !== "new" && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    ยังไม่มีข้อมูล
                  </td>
                </tr>
              )}
              {data.length > 0 && filtered.length === 0 && editingId !== "new" && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
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

