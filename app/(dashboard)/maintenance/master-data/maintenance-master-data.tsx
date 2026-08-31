"use client"

import { useState, useEffect } from "react"
import { Plus, Edit2, Trash2, Save, X, Loader2 } from "lucide-react"
import { GlassButton, GlassCard, GlassInput, GlassTabs } from "@/components/glass"
import { CategoryLinkedMachinesDialog } from "@/components/settings/category-linked-machines-dialog"
import { useTypeConfirm } from "@/components/ui/type-confirm"

// ─── CATEGORIES ───────────────────────────────────────────────────────────────

function CategoriesTab() {
  const confirmType = useTypeConfirm()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: "", code: "" })
  const [machinesDialog, setMachinesDialog] = useState<{
    categoryId: string
    categoryCode: string
    categoryName: string
  } | null>(null)

  const loadData = async () => {
    setLoading(true)
    const res = await fetch("/api/master-data/categories")
    const json = await res.json()
    setData(json.data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSave = async (id?: string) => {
    if (!editForm.name) return alert("กรุณากรอกชื่อหมวดหมู่")

    if (id === "new") {
      const res = await fetch("/api/master-data/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        setEditingId(null)
        loadData()
      } else {
        const body = await res.json()
        alert(body.error?.message || "Error creating category")
      }
    } else {
      const res = await fetch(`/api/master-data/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        setEditingId(null)
        loadData()
      } else {
        const body = await res.json()
        alert(body.error?.message || "Error updating category")
      }
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirmType({ message: "ต้องการลบหมวดหมู่นี้?" })
    if (!ok) return
    const res = await fetch(`/api/master-data/categories/${id}`, { method: "DELETE" })
    if (res.ok) {
      loadData()
    } else {
      const body = await res.json()
      alert(body.error?.message || "Error deleting category")
    }
  }

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <GlassButton onClick={() => { setEditingId("new"); setEditForm({ name: "", code: "" }) }} icon={<Plus className="w-4 h-4"/>}>
          เพิ่มหมวดหมู่
        </GlassButton>
      </div>
      <GlassCard padding="none">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold text-muted-foreground">รหัส</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">ชื่อหมวดหมู่</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center">ใช้งาน</th>
              <th className="px-4 py-3 w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {editingId === "new" && (
              <tr className="bg-blue-50/50">
                <td className="px-4 py-3"><GlassInput value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} placeholder="รหัส" className="h-8" /></td>
                <td className="px-4 py-3"><GlassInput value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="ชื่อหมวดหมู่ *" className="h-8 border-blue-300" /></td>
                <td className="px-4 py-3 text-center">-</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => setEditingId(null)} className="p-1.5 text-muted-foreground hover:text-foreground rounded bg-background"><X className="w-4 h-4" /></button>
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
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {item._count?.machines || 0} เครื่อง
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-muted-foreground hover:text-foreground rounded bg-background"><X className="w-4 h-4" /></button>
                      <button onClick={() => handleSave(item.id)} className="p-1.5 text-blue-600 hover:text-blue-700 bg-blue-50 rounded"><Save className="w-4 h-4" /></button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{item.code || "-"}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                    <td className="px-4 py-3 text-muted-foreground align-top">
                      {(item._count?.machines || 0) === 0 ? (
                        <div className="text-center text-muted-foreground">—</div>
                      ) : (
                        <div className="flex flex-col gap-1.5 items-center">
                          <span className="text-sm font-semibold text-foreground tabular-nums">
                            {item._count?.machines || 0} เครื่อง
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setMachinesDialog({
                                categoryId: item.id,
                                categoryCode: item.code || "",
                                categoryName: item.name,
                              })
                            }
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            ดูรายการเครื่อง
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => { setEditingId(item.id); setEditForm({ name: item.name, code: item.code || "" }) }} className="p-1.5 text-muted-foreground hover:text-blue-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 text-muted-foreground hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
      <p className="text-xs text-muted-foreground">
        จำนวนเครื่องนับเฉพาะที่ยังไม่ถูกลบออกจากระบบ · กดดูรายการเครื่องเพื่อเปิดรายการพร้อมช่องค้นหา
      </p>
      <CategoryLinkedMachinesDialog
        open={machinesDialog != null}
        onClose={() => setMachinesDialog(null)}
        categoryId={machinesDialog?.categoryId ?? null}
        categoryCode={machinesDialog?.categoryCode ?? ""}
        categoryName={machinesDialog?.categoryName ?? ""}
      />
    </div>
  )
}

// ─── MAINTENANCE TYPES ────────────────────────────────────────────────────────

function MaintenanceTypesTab() {
  const confirmType = useTypeConfirm()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: "", code: "", color: "#3b82f6" })

  const loadData = async () => {
    setLoading(true)
    const res = await fetch("/api/master-data/maintenance-types")
    const json = await res.json()
    setData(json.data || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleSave = async (id?: string) => {
    if (!editForm.name || !editForm.code) return alert("กรุณากรอกชื่อและรหัส")

    if (id === "new") {
      const res = await fetch("/api/master-data/maintenance-types", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm),
      })
      if (res.ok) { setEditingId(null); loadData() }
      else { const b = await res.json(); alert(b.error?.message || "Error") }
    } else {
      const res = await fetch(`/api/master-data/maintenance-types/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm),
      })
      if (res.ok) { setEditingId(null); loadData() }
      else { const b = await res.json(); alert(b.error?.message || "Error") }
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirmType({ message: "ต้องการลบประเภทนี้?" })
    if (!ok) return
    const res = await fetch(`/api/master-data/maintenance-types/${id}`, { method: "DELETE" })
    if (res.ok) loadData()
    else { const b = await res.json(); alert(b.error?.message || "Error") }
  }

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <GlassButton onClick={() => { setEditingId("new"); setEditForm({ name: "", code: "", color: "#3b82f6" }) }} icon={<Plus className="w-4 h-4"/>}>
          เพิ่มประเภท
        </GlassButton>
      </div>
      <GlassCard padding="none">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold text-muted-foreground w-24">สีแนะนำ</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">รหัส</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">ชื่อประเภทงานซ่อม</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center">อ้างอิงใช้งาน</th>
              <th className="px-4 py-3 w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {editingId === "new" && (
              <tr className="bg-blue-50/50">
                <td className="px-4 py-3"><input type="color" value={editForm.color} onChange={e => setEditForm(prev => ({ ...prev, color: e.target.value }))} className="w-8 h-8 rounded shrink-0 cursor-pointer" /></td>
                <td className="px-4 py-3"><GlassInput value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} placeholder="PM, BM *" className="h-8 border-blue-300" /></td>
                <td className="px-4 py-3"><GlassInput value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="Preventive Maintenance *" className="h-8 border-blue-300" /></td>
                <td className="px-4 py-3 text-center">-</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => setEditingId(null)} className="p-1.5 text-muted-foreground hover:text-foreground rounded bg-background"><X className="w-4 h-4" /></button>
                  <button onClick={() => handleSave("new")} className="p-1.5 text-blue-600 hover:text-blue-700 bg-blue-50 rounded"><Save className="w-4 h-4" /></button>
                </td>
              </tr>
            )}
            {data.map(item => (
              <tr key={item.id} className="hover:bg-muted/60 transition-colors">
                {editingId === item.id ? (
                  <>
                    <td className="px-4 py-3"><input type="color" value={editForm.color} onChange={e => setEditForm(prev => ({ ...prev, color: e.target.value }))} className="w-8 h-8 rounded shrink-0 cursor-pointer" /></td>
                    <td className="px-4 py-3"><GlassInput value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} className="h-8 border-blue-300" /></td>
                    <td className="px-4 py-3"><GlassInput value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="h-8 border-blue-300" /></td>
                    <td className="px-4 py-3 text-center">{item._count?.workOrders || 0} ใบสั่งงาน / {item._count?.maintenancePlans || 0} แผน</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-muted-foreground hover:text-foreground rounded bg-background"><X className="w-4 h-4" /></button>
                      <button onClick={() => handleSave(item.id)} className="p-1.5 text-blue-600 hover:text-blue-700 bg-blue-50 rounded"><Save className="w-4 h-4" /></button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3">
                      <div className="w-6 h-6 rounded border border-black/10 shadow-sm" style={{ backgroundColor: item.color || "#ccc" }} />
                    </td>
                    <td className="px-4 py-3 font-mono font-medium" style={{ color: item.color || "inherit" }}>{item.code}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground text-xs">{(item._count?.workOrders || 0) + (item._count?.maintenancePlans || 0)} รายการ</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => { setEditingId(item.id); setEditForm({ name: item.name, code: item.code, color: item.color || "#3b82f6" }) }} className="p-1.5 text-muted-foreground hover:text-blue-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 text-muted-foreground hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
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

// ─── PAGE ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "categories", label: "หมวดหมู่เครื่องจักร" },
  { id: "maintenance-types", label: "ประเภทงานซ่อม (Maintenance Types)" },
]

export function MaintenanceMasterData() {
  const [activeTab, setActiveTab] = useState<"categories" | "maintenance-types">("categories")

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">ข้อมูลพื้นฐานงานซ่อมบำรุง</h1>
        <p className="text-muted-foreground text-sm mt-1">
          หมวดหมู่เครื่องจักรและประเภทงานซ่อมที่ใบสั่งงานกับแผนซ่อมบำรุงอ้างอิง
        </p>
      </div>

      <GlassTabs
        items={TABS}
        value={activeTab}
        onChange={(id) => setActiveTab(id as "categories" | "maintenance-types")}
        aria-label="ข้อมูลพื้นฐานงานซ่อมบำรุง"
      />

      <div>
        {activeTab === "categories" && <CategoriesTab />}
        {activeTab === "maintenance-types" && <MaintenanceTypesTab />}
      </div>
    </div>
  )
}
