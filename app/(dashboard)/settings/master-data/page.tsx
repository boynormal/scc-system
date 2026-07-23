"use client"

import { useState, useEffect } from "react"
import { Plus, Edit2, Trash2, Save, X, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { SupplierLinkedPartsDialog } from "@/components/settings/supplier-linked-parts-dialog"
import { CategoryLinkedMachinesDialog } from "@/components/settings/category-linked-machines-dialog"

function classNames(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ")
}

// ─── 1. CATEGORIES ────────────────────────────────────────────────────────────

function CategoriesTab() {
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
    if (!confirm("ต้องการลบหมวดหมู่นี้?")) return
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
        <Button onClick={() => { setEditingId("new"); setEditForm({ name: "", code: "" }) }} icon={<Plus className="w-4 h-4"/>}>
          เพิ่มหมวดหมู่
        </Button>
      </div>
      <Card padding="none">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-600">รหัส</th>
              <th className="px-4 py-3 font-semibold text-slate-600">ชื่อหมวดหมู่</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-center">ใช้งาน</th>
              <th className="px-4 py-3 w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {editingId === "new" && (
              <tr className="bg-blue-50/50">
                <td className="px-4 py-3"><Input value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} placeholder="รหัส" className="h-8" /></td>
                <td className="px-4 py-3"><Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="ชื่อหมวดหมู่ *" className="h-8 border-blue-300" /></td>
                <td className="px-4 py-3 text-center">-</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded bg-white"><X className="w-4 h-4" /></button>
                  <button onClick={() => handleSave("new")} className="p-1.5 text-blue-600 hover:text-blue-700 bg-blue-50 rounded"><Save className="w-4 h-4" /></button>
                </td>
              </tr>
            )}
            {data.map(item => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                {editingId === item.id ? (
                  <>
                    <td className="px-4 py-3"><Input value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} className="h-8" /></td>
                    <td className="px-4 py-3"><Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="h-8 border-blue-300" /></td>
                    <td className="px-4 py-3 text-center text-slate-500">
                      {item._count?.machines || 0} เครื่อง
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded bg-white"><X className="w-4 h-4" /></button>
                      <button onClick={() => handleSave(item.id)} className="p-1.5 text-blue-600 hover:text-blue-700 bg-blue-50 rounded"><Save className="w-4 h-4" /></button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-mono text-slate-500">{item.code || "-"}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                    <td className="px-4 py-3 text-slate-600 align-top">
                      {(item._count?.machines || 0) === 0 ? (
                        <div className="text-center text-slate-400">—</div>
                      ) : (
                        <div className="flex flex-col gap-1.5 items-center">
                          <span className="text-sm font-semibold text-slate-700 tabular-nums">
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
                      <button onClick={() => { setEditingId(item.id); setEditForm({ name: item.name, code: item.code || "" }) }} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-slate-500">
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

// ─── 2. DEPARTMENTS ───────────────────────────────────────────────────────────

function DepartmentsTab({ branches }: { branches: any[] }) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: "", code: "", branchId: "", isActive: true })

  const loadData = async () => {
    setLoading(true)
    const res = await fetch("/api/master-data/departments")
    const json = await res.json()
    setData(json.data || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleSave = async (id?: string) => {
    if (!editForm.name) return alert("กรุณากรอกชื่อแผนก")
    if (!editForm.branchId) return alert("กรุณาเลือกสาขา")
    
    if (id === "new") {
      const res = await fetch("/api/master-data/departments", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm),
      })
      if (res.ok) { setEditingId(null); loadData() }
      else { const b = await res.json(); alert(b.error?.message || "Error") }
    } else {
      const res = await fetch(`/api/master-data/departments/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm),
      })
      if (res.ok) { setEditingId(null); loadData() }
      else { const b = await res.json(); alert(b.error?.message || "Error") }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("ต้องการลบแผนกนี้?")) return
    const res = await fetch(`/api/master-data/departments/${id}`, { method: "DELETE" })
    if (res.ok) loadData()
    else { const b = await res.json(); alert(b.error?.message || "Error") }
  }

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditingId("new"); setEditForm({ name: "", code: "", branchId: branches[0]?.id || "", isActive: true }) }} icon={<Plus className="w-4 h-4"/>}>
          เพิ่มแผนก
        </Button>
      </div>
      <Card padding="none">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-600">รหัส</th>
              <th className="px-4 py-3 font-semibold text-slate-600">ชื่อแผนก</th>
              <th className="px-4 py-3 font-semibold text-slate-600">สาขา</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-center">อ้างอิงเครื่องจักร</th>
              <th className="px-4 py-3 w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {editingId === "new" && (
              <tr className="bg-blue-50/50">
                <td className="px-4 py-3"><Input value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} placeholder="รหัส" className="h-8" /></td>
                <td className="px-4 py-3"><Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="ชื่อแผนก *" className="h-8 border-blue-300" /></td>
                <td className="px-4 py-3">
                  <select className="h-8 px-2 border border-slate-300 rounded text-sm w-full outline-blue-500" value={editForm.branchId} onChange={e => setEditForm({ ...editForm, branchId: e.target.value })}>
                    <option value="">เลือกสาขา</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-center">-</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded bg-white"><X className="w-4 h-4" /></button>
                  <button onClick={() => handleSave("new")} className="p-1.5 text-blue-600 hover:text-blue-700 bg-blue-50 rounded"><Save className="w-4 h-4" /></button>
                </td>
              </tr>
            )}
            {data.map(item => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                {editingId === item.id ? (
                  <>
                    <td className="px-4 py-3"><Input value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} className="h-8" /></td>
                    <td className="px-4 py-3"><Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="h-8 border-blue-300" /></td>
                    <td className="px-4 py-3">
                      <select className="h-8 px-2 border border-slate-300 rounded text-sm w-full outline-blue-500" value={editForm.branchId} onChange={e => setEditForm({ ...editForm, branchId: e.target.value })}>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">{item._count?.machines || 0}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded bg-white"><X className="w-4 h-4" /></button>
                      <button onClick={() => handleSave(item.id)} className="p-1.5 text-blue-600 hover:text-blue-700 bg-blue-50 rounded"><Save className="w-4 h-4" /></button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-mono text-slate-500">{item.code || "-"}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                    <td className="px-4 py-3 text-slate-600">{item.branch?.name}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{item._count?.machines || 0}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => { setEditingId(item.id); setEditForm({ name: item.name, code: item.code || "", branchId: item.branchId, isActive: item.isActive }) }} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// ─── 3. MAINTENANCE TYPES ─────────────────────────────────────────────────────

function MaintenanceTypesTab() {
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
    if (!confirm("ต้องการลบประเภทนี้?")) return
    const res = await fetch(`/api/master-data/maintenance-types/${id}`, { method: "DELETE" })
    if (res.ok) loadData()
    else { const b = await res.json(); alert(b.error?.message || "Error") }
  }

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditingId("new"); setEditForm({ name: "", code: "", color: "#3b82f6" }) }} icon={<Plus className="w-4 h-4"/>}>
          เพิ่มประเภท
        </Button>
      </div>
      <Card padding="none">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-600 w-24">สีแนะนำ</th>
              <th className="px-4 py-3 font-semibold text-slate-600">รหัส</th>
              <th className="px-4 py-3 font-semibold text-slate-600">ชื่อประเภทงานซ่อม</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-center">อ้างอิงใช้งาน</th>
              <th className="px-4 py-3 w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {editingId === "new" && (
              <tr className="bg-blue-50/50">
                <td className="px-4 py-3"><input type="color" value={editForm.color} onChange={e => setEditForm(prev => ({ ...prev, color: e.target.value }))} className="w-8 h-8 rounded shrink-0 cursor-pointer" /></td>
                <td className="px-4 py-3"><Input value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} placeholder="PM, BM *" className="h-8 border-blue-300" /></td>
                <td className="px-4 py-3"><Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="Preventive Maintenance *" className="h-8 border-blue-300" /></td>
                <td className="px-4 py-3 text-center">-</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded bg-white"><X className="w-4 h-4" /></button>
                  <button onClick={() => handleSave("new")} className="p-1.5 text-blue-600 hover:text-blue-700 bg-blue-50 rounded"><Save className="w-4 h-4" /></button>
                </td>
              </tr>
            )}
            {data.map(item => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                {editingId === item.id ? (
                  <>
                    <td className="px-4 py-3"><input type="color" value={editForm.color} onChange={e => setEditForm(prev => ({ ...prev, color: e.target.value }))} className="w-8 h-8 rounded shrink-0 cursor-pointer" /></td>
                    <td className="px-4 py-3"><Input value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} className="h-8 border-blue-300" /></td>
                    <td className="px-4 py-3"><Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="h-8 border-blue-300" /></td>
                    <td className="px-4 py-3 text-center">{item._count?.workOrders || 0} ใบสั่งงาน / {item._count?.maintenancePlans || 0} แผน</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded bg-white"><X className="w-4 h-4" /></button>
                      <button onClick={() => handleSave(item.id)} className="p-1.5 text-blue-600 hover:text-blue-700 bg-blue-50 rounded"><Save className="w-4 h-4" /></button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3">
                      <div className="w-6 h-6 rounded border border-black/10 shadow-sm" style={{ backgroundColor: item.color || "#ccc" }} />
                    </td>
                    <td className="px-4 py-3 font-mono font-medium" style={{ color: item.color || "inherit" }}>{item.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                    <td className="px-4 py-3 text-center text-slate-500 text-xs">{(item._count?.workOrders || 0) + (item._count?.maintenancePlans || 0)} รายการ</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => { setEditingId(item.id); setEditForm({ name: item.name, code: item.code, color: item.color || "#3b82f6" }) }} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// ─── 4. SUPPLIERS ─────────────────────────────────────────────────────────────

type SupplierRow = {
  id: string
  code: string
  name: string
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  leadTimeDays: number | null
  isActive: boolean
  _count: { spareParts: number }
}

const emptySupplierForm = {
  name: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  leadTimeDays: "",
  isActive: true,
}

function SuppliersTab() {
  const [data, setData] = useState<SupplierRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(() => ({ ...emptySupplierForm }))
  const [partsDialog, setPartsDialog] = useState<{
    supplierId: string
    supplierCode: string
    supplierName: string
  } | null>(null)

  const loadData = async () => {
    setLoading(true)
    const res = await fetch("/api/master-data/suppliers?includeInactive=1")
    const json = await res.json()
    setData(json.data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const payloadFromForm = () => {
    const lt =
      editForm.leadTimeDays === ""
        ? null
        : (() => {
            const n = Number(editForm.leadTimeDays)
            return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
          })()
    return {
      name: editForm.name.trim(),
      contactName: editForm.contactName.trim() || null,
      phone: editForm.phone.trim() || null,
      email: editForm.email.trim() || null,
      address: editForm.address.trim() || null,
      leadTimeDays: lt,
      isActive: editForm.isActive,
    }
  }

  const handleSave = async (id?: string) => {
    if (!editForm.name.trim()) {
      alert("กรุณากรอกชื่อซัพพลายเออร์")
      return
    }
    if (id === "new") {
      const res = await fetch("/api/master-data/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadFromForm()),
      })
      if (res.ok) {
        setEditingId(null)
        setEditForm({ ...emptySupplierForm })
        loadData()
      } else {
        const b = await res.json()
        alert(b.error?.message || "บันทึกไม่สำเร็จ")
      }
    } else if (id) {
      const res = await fetch(`/api/master-data/suppliers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadFromForm()),
      })
      if (res.ok) {
        setEditingId(null)
        loadData()
      } else {
        const b = await res.json()
        alert(b.error?.message || "บันทึกไม่สำเร็จ")
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("ต้องการลบซัพพลายเออร์นี้?")) return
    const res = await fetch(`/api/master-data/suppliers/${id}`, { method: "DELETE" })
    if (res.ok) loadData()
    else {
      const b = await res.json()
      alert(b.error?.message || "ลบไม่สำเร็จ")
    }
  }

  const startEdit = (item: SupplierRow) => {
    setEditingId(item.id)
    setEditForm({
      name: item.name,
      contactName: item.contactName ?? "",
      phone: item.phone ?? "",
      email: item.email ?? "",
      address: item.address ?? "",
      leadTimeDays: item.leadTimeDays != null ? String(item.leadTimeDays) : "",
      isActive: item.isActive,
    })
  }

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    )
  }

  const formGrid = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {editingId && editingId !== "new" && (
        <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          รหัสซัพพลายเออร์:{" "}
          <span className="font-mono font-medium text-slate-800">
            {data.find((r) => r.id === editingId)?.code ?? "—"}
          </span>
          <span className="text-slate-400 ml-2">ออกโดยระบบอัตโนมัติ (แก้ไขไม่ได้)</span>
        </div>
      )}
      {editingId === "new" && (
        <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-slate-600">
          รหัสจะถูกสร้างอัตโนมัติหลังบันทึก <span className="text-slate-400">(รูปแบบ S-XXXXXXXXXXXX)</span>
        </div>
      )}
      <div className="sm:col-span-2">
        <label className="text-xs text-slate-500 block mb-1">ชื่อซัพพลายเออร์ *</label>
        <Input
          value={editForm.name}
          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="บริษัท ..."
          className="h-9"
        />
      </div>
      <div>
        <label className="text-xs text-slate-500 block mb-1">ผู้ติดต่อ</label>
        <Input
          value={editForm.contactName}
          onChange={(e) => setEditForm((f) => ({ ...f, contactName: e.target.value }))}
          className="h-9"
        />
      </div>
      <div>
        <label className="text-xs text-slate-500 block mb-1">โทรศัพท์</label>
        <Input
          value={editForm.phone}
          onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
          className="h-9"
        />
      </div>
      <div>
        <label className="text-xs text-slate-500 block mb-1">อีเมล</label>
        <Input
          value={editForm.email}
          onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
          className="h-9"
          type="email"
        />
      </div>
      <div>
        <label className="text-xs text-slate-500 block mb-1">วันรอของ (Lead time)</label>
        <Input
          value={editForm.leadTimeDays}
          onChange={(e) => setEditForm((f) => ({ ...f, leadTimeDays: e.target.value }))}
          className="h-9"
          type="number"
          min={0}
          placeholder="วัน"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs text-slate-500 block mb-1">ที่อยู่</label>
        <Input
          value={editForm.address}
          onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
          className="h-9"
        />
      </div>
      <div className="flex items-end pb-1">
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={editForm.isActive}
            onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
            className="rounded border-slate-300"
          />
          เปิดใช้งาน
        </label>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditingId("new")
            setEditForm({ ...emptySupplierForm })
          }}
          icon={<Plus className="w-4 h-4" />}
        >
          เพิ่มซัพพลายเออร์
        </Button>
      </div>
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[760px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-600">รหัส</th>
                <th className="px-4 py-3 font-semibold text-slate-600">ชื่อ</th>
                <th className="px-4 py-3 font-semibold text-slate-600">ผู้ติดต่อ</th>
                <th className="px-4 py-3 font-semibold text-slate-600">โทร</th>
                <th className="px-4 py-3 font-semibold text-slate-600 text-center">Lead (วัน)</th>
                <th className="px-4 py-3 font-semibold text-slate-600 w-[140px]">อะไหล่</th>
                <th className="px-4 py-3 font-semibold text-slate-600">สถานะ</th>
                <th className="px-4 py-3 w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {editingId === "new" && (
                <tr className="bg-blue-50/50">
                  <td colSpan={8} className="px-4 py-4">
                    {formGrid}
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="outline" type="button" onClick={() => setEditingId(null)}>
                        ยกเลิก
                      </Button>
                      <Button type="button" onClick={() => handleSave("new")} icon={<Save className="w-4 h-4" />}>
                        บันทึก
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
              {data.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  {editingId === item.id ? (
                    <td colSpan={8} className="px-4 py-4 bg-blue-50/30">
                      {formGrid}
                      <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" type="button" onClick={() => setEditingId(null)}>
                          ยกเลิก
                        </Button>
                        <Button type="button" onClick={() => handleSave(item.id)} icon={<Save className="w-4 h-4" />}>
                          บันทึก
                        </Button>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-mono text-slate-700">{item.code}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                      <td className="px-4 py-3 text-slate-600">{item.contactName ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{item.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {item.leadTimeDays != null ? item.leadTimeDays : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 align-top">
                        {item._count.spareParts === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            <span className="text-sm font-semibold text-slate-700 tabular-nums">
                              {item._count.spareParts} รายการ
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setPartsDialog({
                                  supplierId: item.id,
                                  supplierCode: item.code,
                                  supplierName: item.name,
                                })
                              }
                              className="text-xs text-blue-600 hover:text-blue-800 hover:underline text-left w-fit"
                            >
                              ดูรายการอะไหล่
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.isActive ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {item.isActive ? "ใช้งาน" : "ปิด"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-slate-500">
        รหัสซัพพลายเออร์สร้างอัตโนมัติเท่านั้น (ไม่ซ้ำทั้งระบบ · รูปแบบ S-XXXXXXXXXXXX) · หน้าเพิ่มอะไหล่แสดงเฉพาะซัพพลายเออร์ที่เปิดใช้งาน · รายชื่ออะไหล่จำนวนมากเปิดในหน้าต่างพร้อมช่องค้นหา
      </p>

      <SupplierLinkedPartsDialog
        open={partsDialog != null}
        onClose={() => setPartsDialog(null)}
        supplierId={partsDialog?.supplierId ?? null}
        supplierCode={partsDialog?.supplierCode ?? ""}
        supplierName={partsDialog?.supplierName ?? ""}
      />
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<
    "categories" | "departments" | "maintenance-types" | "suppliers"
  >("categories")
  const [branches, setBranches] = useState<any[]>([])

  useEffect(() => {
    fetch("/api/master-data/branches").then(r => r.json()).then(d => setBranches(d.data || []))
  }, [])

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">ข้อมูลพื้นฐาน (Master Data)</h1>
        <p className="text-slate-500 text-sm mt-1">
          จัดการหมวดหมู่ แผนก ประเภทการซ่อมบำรุง และซัพพลายเออร์ในระบบ
        </p>
      </div>

      <div className="flex flex-wrap border-b border-slate-200 gap-x-1">
        <button
          onClick={() => setActiveTab("categories")}
          className={classNames(
            "px-5 py-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === "categories" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          หมวดหมู่เครื่องจักร
        </button>
        <button
          onClick={() => setActiveTab("departments")}
          className={classNames(
            "px-5 py-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === "departments" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          แผนก / ฝ่าย (Departments)
        </button>
        <button
          onClick={() => setActiveTab("maintenance-types")}
          className={classNames(
            "px-5 py-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === "maintenance-types" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          ประเภทงานซ่อม (Maintenance Types)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("suppliers")}
          className={classNames(
            "px-5 py-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === "suppliers"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          ซัพพลายเออร์ (Suppliers)
        </button>
      </div>

      <div className="pt-2">
        {activeTab === "categories" && <CategoriesTab />}
        {activeTab === "departments" && <DepartmentsTab branches={branches} />}
        {activeTab === "maintenance-types" && <MaintenanceTypesTab />}
        {activeTab === "suppliers" && <SuppliersTab />}
      </div>
    </div>
  )
}
