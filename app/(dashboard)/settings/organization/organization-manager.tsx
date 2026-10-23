"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Edit2, Trash2, Save, X, Loader2 } from "lucide-react"
import { GlassButton, GlassCard, GlassInput } from "@/components/glass"
import { ModuleTabs } from "@/components/shell/module-tabs"
import { useTypeConfirm } from "@/components/ui/type-confirm"

type MasterRow = {
  id: string
  name: string
  code: string | null
  isActive: boolean
}

type MasterLabels = {
  description: string
  add: string
  nameColumn: string
  namePlaceholder: string
  nameRequired: string
  confirmDelete: string
}

function MasterTable({ apiPath, labels }: { apiPath: string; labels: MasterLabels }) {
  const confirmType = useTypeConfirm()
  const [data, setData] = useState<MasterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: "", code: "", isActive: true })

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(apiPath)
    const json = await res.json()
    setData((json.data || []) as MasterRow[])
    setLoading(false)
  }, [apiPath])

  useEffect(() => { loadData() }, [loadData])

  const handleSave = async (id?: string) => {
    if (!editForm.name.trim()) return alert(labels.nameRequired)

    const body = { name: editForm.name.trim(), code: editForm.code.trim(), isActive: editForm.isActive }
    if (id === "new") {
      const res = await fetch(apiPath, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (res.ok) { setEditingId(null); loadData() }
      else { const b = await res.json(); alert(b.error?.message || "Error") }
    } else {
      const res = await fetch(`${apiPath}/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (res.ok) { setEditingId(null); loadData() }
      else { const b = await res.json(); alert(b.error?.message || "Error") }
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirmType({ message: labels.confirmDelete })
    if (!ok) return
    const res = await fetch(`${apiPath}/${id}`, { method: "DELETE" })
    if (res.ok) loadData()
    else { const b = await res.json(); alert(b.error?.message || "Error") }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-sm text-foreground">{labels.description}</p>
        <GlassButton onClick={() => { setEditingId("new"); setEditForm({ name: "", code: "", isActive: true }) }} icon={<Plus className="w-4 h-4"/>}>
          {labels.add}
        </GlassButton>
      </div>
      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : (
      <GlassCard padding="none">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold text-foreground">รหัส</th>
              <th className="px-4 py-3 font-semibold text-foreground">{labels.nameColumn}</th>
              <th className="px-4 py-3 w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {editingId === "new" && (
              <tr className="bg-blue-50/50">
                <td className="px-4 py-3"><GlassInput value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} placeholder="รหัส" className="h-8" /></td>
                <td className="px-4 py-3"><GlassInput value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder={labels.namePlaceholder} className="h-8 border-blue-300" /></td>
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
      )}
    </section>
  )
}

const DEPARTMENT_LABELS: MasterLabels = {
  description: "บอกว่าบุคคลหรือเครื่องจักรสังกัดแผนกไหน ใช้ร่วมกันทั้งเครื่องจักรและบุคลากร",
  add: "เพิ่มแผนก",
  nameColumn: "ชื่อแผนก",
  namePlaceholder: "ชื่อแผนก *",
  nameRequired: "กรุณากรอกชื่อแผนก",
  confirmDelete: "ต้องการลบแผนกนี้?",
}

const JOB_GROUP_LABELS: MasterLabels = {
  description: "ใช้คิด Man Hour ตามประเภทงาน กลุ่มหนึ่งมีคนจากหลายแผนกได้",
  add: "เพิ่มกลุ่มงาน",
  nameColumn: "ชื่อกลุ่มงาน",
  namePlaceholder: "ชื่อกลุ่มงาน *",
  nameRequired: "กรุณากรอกชื่อกลุ่มงาน",
  confirmDelete: "ต้องการลบกลุ่มงานนี้?",
}

const TABS = [
  { key: "departments", label: "แผนก" },
  { key: "job-groups", label: "กลุ่มงาน" },
] as const

export function OrganizationManager() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["key"]>("departments")

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">แผนก / กลุ่มงาน</h1>
        <p className="text-foreground text-sm mt-1">
          แผนกบอกว่าบุคคลอยู่ที่ไหน ส่วนกลุ่มงานใช้คิด Man Hour ทั้งสองรายการแยกกัน
        </p>
      </div>

      <ModuleTabs
        aria-label="แผนกและกลุ่มงาน"
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as (typeof TABS)[number]["key"])}
        items={TABS.map((tab) => ({ key: tab.key, label: tab.label }))}
      />

      {activeTab === "departments" ? (
        <MasterTable apiPath="/api/master-data/departments" labels={DEPARTMENT_LABELS} />
      ) : (
        <MasterTable apiPath="/api/master-data/job-groups" labels={JOB_GROUP_LABELS} />
      )}
    </div>
  )
}
