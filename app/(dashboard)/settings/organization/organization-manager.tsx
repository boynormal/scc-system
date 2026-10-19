"use client"

import { useState, useEffect } from "react"
import { Plus, Edit2, Trash2, Save, X, Loader2 } from "lucide-react"
import { GlassButton, GlassCard, GlassInput } from "@/components/glass"
import { useTypeConfirm } from "@/components/ui/type-confirm"

type DepartmentRow = {
  id: string
  name: string
  code: string | null
  isActive: boolean
}

function DepartmentsTab() {
  const confirmType = useTypeConfirm()
  const [data, setData] = useState<DepartmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: "", code: "", isActive: true })

  const loadData = async () => {
    setLoading(true)
    const deptRes = await fetch("/api/master-data/departments")
    const deptJson = await deptRes.json()
    setData((deptJson.data || []) as DepartmentRow[])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleSave = async (id?: string) => {
    if (!editForm.name.trim()) return alert("กรุณากรอกชื่อแผนก")

    const body = { name: editForm.name.trim(), code: editForm.code.trim(), isActive: editForm.isActive }
    if (id === "new") {
      const res = await fetch("/api/master-data/departments", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (res.ok) { setEditingId(null); loadData() }
      else { const b = await res.json(); alert(b.error?.message || "Error") }
    } else {
      const res = await fetch(`/api/master-data/departments/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (res.ok) { setEditingId(null); loadData() }
      else { const b = await res.json(); alert(b.error?.message || "Error") }
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirmType({ message: "ต้องการลบแผนกนี้?" })
    if (!ok) return
    const res = await fetch(`/api/master-data/departments/${id}`, { method: "DELETE" })
    if (res.ok) loadData()
    else { const b = await res.json(); alert(b.error?.message || "Error") }
  }

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <GlassButton onClick={() => { setEditingId("new"); setEditForm({ name: "", code: "", isActive: true }) }} icon={<Plus className="w-4 h-4"/>}>
          เพิ่มแผนก
        </GlassButton>
      </div>
      <GlassCard padding="none">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold text-foreground">รหัส</th>
              <th className="px-4 py-3 font-semibold text-foreground">ชื่อแผนก</th>
              <th className="px-4 py-3 w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {editingId === "new" && (
              <tr className="bg-blue-50/50">
                <td className="px-4 py-3"><GlassInput value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} placeholder="รหัส" className="h-8" /></td>
                <td className="px-4 py-3"><GlassInput value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="ชื่อแผนก *" className="h-8 border-blue-300" /></td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => setEditingId(null)} className="p-1.5 text-foreground rounded bg-background"><X className="w-4 h-4" /></button>
                  <button onClick={() => handleSave("new")} className="p-1.5 text-blue-600 hover:text-blue-700 bg-blue-50 rounded"><Save className="w-4 h-4" /></button>
                </td>
              </tr>
            )}
            {data.map(item => (
              <tr key={item.id} className="hover:bg-muted/60 transition-colors">
                {editingId === item.id ? (
                  <>
                    <td className="px-4 py-3"><GlassInput value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} className="h-8" /></td>
                    <td className="px-4 py-3"><GlassInput value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="h-8 border-blue-300" /></td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-foreground rounded bg-background"><X className="w-4 h-4" /></button>
                      <button onClick={() => handleSave(item.id)} className="p-1.5 text-blue-600 hover:text-blue-700 bg-blue-50 rounded"><Save className="w-4 h-4" /></button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-mono text-foreground">{item.code || "-"}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => { setEditingId(item.id); setEditForm({ name: item.name, code: item.code || "", isActive: item.isActive }) }} className="p-1.5 text-foreground hover:text-blue-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 text-foreground hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  )
}

export function OrganizationManager() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">แผนก / ฝ่าย</h1>
        <p className="text-foreground text-sm mt-1">
          แผนกเป็นรายการเดียวของบริษัท ใช้ร่วมกันทั้งเครื่องจักรและบุคลากร
        </p>
      </div>

      <DepartmentsTab />
    </div>
  )
}
