"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Edit2, Trash2, Save, X, Loader2 } from "lucide-react"
import { GlassButton, GlassCard, GlassInput } from "@/components/glass"
import { DetailsDisplay, DetailsField } from "@/components/transport/master-data/DetailsField"

type LookupItem = {
  id: string
  name: string
  details: string | null
  sortOrder: number
  isActive: boolean
}

type LookupTabProps = {
  apiPath: string
  addLabel: string
  nameLabel: string
}
const emptyForm = { name: "", details: "", sortOrder: "0" }

export function LookupTypesTab({ apiPath, addLabel, nameLabel }: LookupTabProps) {
  const [data, setData] = useState<LookupItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(apiPath)
    const json = await res.json()
    setData(json.data ?? [])
    setLoading(false)
  }, [apiPath])
  useEffect(() => {
    loadData()
  }, [loadData])
  const handleSave = async (id?: string) => {
    if (!editForm.name.trim()) return alert(`กรุณากรอก${nameLabel}`)
    const payload = {
      name: editForm.name.trim(),
      details: editForm.details.trim() || undefined,
      sortOrder: Number(editForm.sortOrder) || 0,
    }
    if (id === "new") {
      const res = await fetch(apiPath, {
        method: "POST",
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
    } else {
      const res = await fetch(`${apiPath}/${id}`, {
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
  }
  const handleDeactivate = async (id: string) => {
    if (!confirm("ปิดใช้งานรายการนี้?")) return
    const res = await fetch(`${apiPath}/${id}`, { method: "DELETE" })
    if (res.ok) loadData()
    else {
      const b = await res.json()
      alert(typeof b.error === "string" ? b.error : b.error?.message ?? "เกิดข้อผิดพลาด")
    }
  }
  const handleReactivate = async (item: LookupItem) => {
    const res = await fetch(`${apiPath}/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    })
    if (res.ok) loadData()
  }
  const renderFormCells = (id: string) => (
    <>
      <td className="px-4 py-3 align-top">
        <GlassInput
          type="number"
          min={0}
          value={editForm.sortOrder}
          onChange={(e) => setEditForm((f) => ({ ...f, sortOrder: e.target.value }))}
          className="h-8 w-16 border-cyan-300"
        />
      </td>
      <td className="px-4 py-3 align-top">
        <GlassInput
          value={editForm.name}
          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
          placeholder={id === "new" ? `${nameLabel} *` : undefined}
          className="h-8 border-cyan-300"
        />
      </td>
      <td className="min-w-0 px-4 py-3 align-top">
        <DetailsField
          value={editForm.details}
          onChange={(details) => setEditForm((f) => ({ ...f, details }))}
        />
      </td>
      <td className="px-4 py-3 align-top">-</td>
      <td className="px-4 py-3 text-right space-x-2 align-top">
        <button type="button" onClick={() => setEditingId(null)} className="p-1.5 text-muted-foreground hover:text-muted-foreground rounded bg-background">
          <X className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => handleSave(id)} className="p-1.5 text-cyan-600 hover:text-cyan-700 bg-cyan-50 rounded">
          <Save className="w-4 h-4" />
        </button>
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
      <div className="flex justify-end">
        <GlassButton
          onClick={() => {
            setEditingId("new")
            setEditForm({ ...emptyForm, sortOrder: String(data.length + 1) })
          }}
          icon={<Plus className="w-4 h-4" />}
        >
          {addLabel}
        </GlassButton>
      </div>
      <GlassCard padding="none">
        <div className="min-w-0 overflow-hidden">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-4 py-3 font-semibold text-muted-foreground w-20">ลำดับ</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">{nameLabel}</th>
                <th className="min-w-0 px-4 py-3 font-semibold text-muted-foreground">รายละเอียด</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground w-24">สถานะ</th>
                <th className="px-4 py-3 w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {editingId === "new" && (
                <tr className="bg-cyan-50/50">{renderFormCells("new")}</tr>
              )}
              {data.map((item) => (
                <tr key={item.id} className={`hover:bg-muted/60 transition-colors ${!item.isActive ? "opacity-50" : ""}`}>
                  {editingId === item.id ? (
                    renderFormCells(item.id)
                  ) : (
                    <>
                      <td className="px-4 py-3 text-muted-foreground align-top">{item.sortOrder}</td>
                      <td className="px-4 py-3 font-medium text-foreground align-top">{item.name}</td>
                      <td className="px-4 py-3 align-top max-w-xs"><DetailsDisplay value={item.details} /></td>
                      <td className="px-4 py-3 align-top">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${item.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                          {item.isActive ? "ใช้งาน" : "ปิด"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2 align-top">
                        {item.isActive ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(item.id)
                                setEditForm({
                                  name: item.name,
                                  details: item.details ?? "",
                                  sortOrder: String(item.sortOrder),
                                })
                              }}
                              className="p-1.5 text-muted-foreground hover:text-cyan-600 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => handleDeactivate(item.id)} className="p-1.5 text-muted-foreground hover:text-red-600 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button type="button" onClick={() => handleReactivate(item)} className="text-xs text-cyan-600 hover:underline">
                            เปิดใช้งาน
                          </button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {data.length === 0 && editingId !== "new" && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    ยังไม่มีข้อมูล
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
