"use client"

import { useState, useEffect } from "react"
import { Plus, Edit2, Trash2, Save, X, Loader2 } from "lucide-react"
import { GlassButton, GlassCard, GlassInput, GlassTabs } from "@/components/glass"
import { SupplierLinkedPartsDialog } from "@/components/settings/supplier-linked-parts-dialog"
import { useTypeConfirm } from "@/components/ui/type-confirm"

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────

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
  const confirmType = useTypeConfirm()
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
    const ok = await confirmType({ message: "ต้องการลบซัพพลายเออร์นี้?" })
    if (!ok) return
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
        <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
          รหัสซัพพลายเออร์:{" "}
          <span className="font-mono font-medium text-foreground">
            {data.find((r) => r.id === editingId)?.code ?? "—"}
          </span>
          <span className="text-muted-foreground ml-2">ออกโดยระบบอัตโนมัติ (แก้ไขไม่ได้)</span>
        </div>
      )}
      {editingId === "new" && (
        <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-blue-100 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/40 px-3 py-2 text-xs text-muted-foreground">
          รหัสจะถูกสร้างอัตโนมัติหลังบันทึก <span className="text-muted-foreground">(รูปแบบ S-XXXXXXXXXXXX)</span>
        </div>
      )}
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs text-muted-foreground">ชื่อซัพพลายเออร์ *</label>
        <GlassInput
          value={editForm.name}
          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="บริษัท ..."
          className="h-9"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">ผู้ติดต่อ</label>
        <GlassInput
          value={editForm.contactName}
          onChange={(e) => setEditForm((f) => ({ ...f, contactName: e.target.value }))}
          className="h-9"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">โทรศัพท์</label>
        <GlassInput
          value={editForm.phone}
          onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
          className="h-9"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">อีเมล</label>
        <GlassInput
          value={editForm.email}
          onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
          className="h-9"
          type="email"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">วันรอของ (Lead time)</label>
        <GlassInput
          value={editForm.leadTimeDays}
          onChange={(e) => setEditForm((f) => ({ ...f, leadTimeDays: e.target.value }))}
          className="h-9"
          type="number"
          min={0}
          placeholder="วัน"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs text-muted-foreground">ที่อยู่</label>
        <GlassInput
          value={editForm.address}
          onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
          className="h-9"
        />
      </div>
      <div className="flex items-end pb-1">
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={editForm.isActive}
            onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
            className="rounded border-border dark:border-slate-600"
          />
          เปิดใช้งาน
        </label>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <GlassButton
          onClick={() => {
            setEditingId("new")
            setEditForm({ ...emptySupplierForm })
          }}
          icon={<Plus className="w-4 h-4" />}
        >
          เพิ่มซัพพลายเออร์
        </GlassButton>
      </div>
      <GlassCard padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[760px]">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-4 py-3 font-semibold text-muted-foreground">รหัส</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">ชื่อ</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">ผู้ติดต่อ</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">โทร</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-center">Lead (วัน)</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground w-[140px]">อะไหล่</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">สถานะ</th>
                <th className="px-4 py-3 w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {editingId === "new" && (
                <tr className="bg-blue-50/50">
                  <td colSpan={8} className="px-4 py-4">
                    {formGrid}
                    <div className="flex justify-end gap-2 mt-4">
                      <GlassButton variant="outline" type="button" onClick={() => setEditingId(null)}>
                        ยกเลิก
                      </GlassButton>
                      <GlassButton type="button" onClick={() => handleSave("new")} icon={<Save className="w-4 h-4" />}>
                        บันทึก
                      </GlassButton>
                    </div>
                  </td>
                </tr>
              )}
              {data.map((item) => (
                <tr key={item.id} className="hover:bg-muted/60 transition-colors">
                  {editingId === item.id ? (
                    <td colSpan={8} className="px-4 py-4 bg-blue-50/30">
                      {formGrid}
                      <div className="flex justify-end gap-2 mt-4">
                        <GlassButton variant="outline" type="button" onClick={() => setEditingId(null)}>
                          ยกเลิก
                        </GlassButton>
                        <GlassButton type="button" onClick={() => handleSave(item.id)} icon={<Save className="w-4 h-4" />}>
                          บันทึก
                        </GlassButton>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-mono text-foreground">{item.code}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.contactName ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {item.leadTimeDays != null ? item.leadTimeDays : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground align-top">
                        {item._count.spareParts === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            <span className="text-sm font-semibold text-foreground tabular-nums">
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
                            item.isActive ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.isActive ? "ใช้งาน" : "ปิด"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="p-1.5 text-muted-foreground hover:text-blue-600 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-muted-foreground hover:text-red-600 transition-colors"
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
      </GlassCard>
      <p className="text-xs text-muted-foreground">
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

// ─── UNITS ────────────────────────────────────────────────────────────────────

type UnitRow = { id: string; code: string; name: string; isActive: boolean }

function UnitsTab() {
  const confirmType = useTypeConfirm()
  const [data, setData] = useState<UnitRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ code: "", name: "", isActive: true })

  const loadData = async () => {
    setLoading(true)
    const res = await fetch("/api/master-data/units?includeInactive=1")
    const json = await res.json()
    setData((json.data || []) as UnitRow[])
    setLoading(false)
  }

  useEffect(() => {
    void loadData()
  }, [])

  const handleSave = async (id?: string) => {
    if (!editForm.code.trim() || !editForm.name.trim()) {
      alert("กรุณากรอกรหัสและชื่อหน่วย")
      return
    }
    const payload = { code: editForm.code.trim(), name: editForm.name.trim(), isActive: editForm.isActive }
    if (id === "new") {
      const res = await fetch("/api/master-data/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setEditingId(null)
        void loadData()
      } else {
        const b = await res.json()
        alert(b.error?.message || "บันทึกไม่สำเร็จ")
      }
    } else {
      const res = await fetch(`/api/master-data/units/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setEditingId(null)
        void loadData()
      } else {
        const b = await res.json()
        alert(b.error?.message || "บันทึกไม่สำเร็จ")
      }
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirmType({ message: "ต้องการลบหน่วยนับนี้?" })
    if (!ok) return
    const res = await fetch(`/api/master-data/units/${id}`, { method: "DELETE" })
    if (res.ok) void loadData()
    else {
      const b = await res.json()
      alert(b.error?.message || "ลบไม่สำเร็จ")
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <GlassButton
          onClick={() => {
            setEditingId("new")
            setEditForm({ code: "", name: "", isActive: true })
          }}
          icon={<Plus className="h-4 w-4" />}
        >
          เพิ่มหน่วย
        </GlassButton>
      </div>
      <GlassCard padding="none">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted">
            <tr>
              <th className="px-4 py-3 font-semibold text-muted-foreground">รหัส</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">ชื่อ</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">สถานะ</th>
              <th className="w-32 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {editingId === "new" && (
              <tr className="bg-blue-50/50">
                <td className="px-4 py-3">
                  <GlassInput
                    value={editForm.code}
                    onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                    placeholder="PCS"
                    className="h-8 border-blue-300"
                  />
                </td>
                <td className="px-4 py-3">
                  <GlassInput
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="ชิ้น"
                    className="h-8 border-blue-300"
                  />
                </td>
                <td className="px-4 py-3">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.isActive}
                      onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    />
                    ใช้งาน
                  </label>
                </td>
                <td className="space-x-2 px-4 py-3 text-right">
                  <button type="button" onClick={() => setEditingId(null)} className="rounded bg-background p-1.5 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => handleSave("new")} className="rounded bg-blue-50 p-1.5 text-blue-600 hover:text-blue-700">
                    <Save className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            )}
            {data.map((item) => (
              <tr key={item.id} className="transition-colors hover:bg-muted/60">
                {editingId === item.id ? (
                  <>
                    <td className="px-4 py-3">
                      <GlassInput
                        value={editForm.code}
                        onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                        className="h-8 border-blue-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <GlassInput
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="h-8 border-blue-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editForm.isActive}
                          onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                        />
                        ใช้งาน
                      </label>
                    </td>
                    <td className="space-x-2 px-4 py-3 text-right">
                      <button type="button" onClick={() => setEditingId(null)} className="rounded bg-background p-1.5 text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => handleSave(item.id)} className="rounded bg-blue-50 p-1.5 text-blue-600 hover:text-blue-700">
                        <Save className="h-4 w-4" />
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">{item.code}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                    <td className="px-4 py-3">
                      <span className={item.isActive ? "text-xs text-emerald-600" : "text-xs text-muted-foreground"}>
                        {item.isActive ? "ใช้งาน" : "ปิด"}
                      </span>
                    </td>
                    <td className="space-x-2 px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(item.id)
                          setEditForm({ code: item.code, name: item.name, isActive: item.isActive })
                        }}
                        className="p-1.5 text-muted-foreground transition-colors hover:text-blue-600"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-muted-foreground transition-colors hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
  { id: "suppliers", label: "ซัพพลายเออร์ (Suppliers)" },
  { id: "units", label: "หน่วยนับ (Units)" },
]

export function PartnersManager() {
  const [activeTab, setActiveTab] = useState<"suppliers" | "units">("suppliers")

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">คู่ค้าและหน่วยนับ</h1>
        <p className="text-muted-foreground text-sm mt-1">
          สมุดคู่ค้าและหน่วยนับที่ทุกโมดูลใช้ร่วมกัน — การเงินเรียกซัพพลายเออร์ว่าผู้ขาย และอะไหล่กับทะเบียนสินทรัพย์ชี้แถวเดียวกันนี้
        </p>
      </div>

      <GlassTabs
        items={TABS}
        value={activeTab}
        onChange={(id) => setActiveTab(id as "suppliers" | "units")}
        aria-label="คู่ค้าและหน่วยนับ"
      />

      <div>
        {activeTab === "suppliers" && <SuppliersTab />}
        {activeTab === "units" && <UnitsTab />}
      </div>
    </div>
  )
}
