"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { ModuleAccessPicker, type ModuleAccessValue } from "@/components/settings/module-access-picker"

const PERMISSIONS = [
  { key: "machines.view", label: "ดูเครื่องจักร" },
  { key: "machines.create", label: "สร้างเครื่องจักร" },
  { key: "machines.edit", label: "แก้ไขเครื่องจักร" },
  { key: "machines.delete", label: "ลบเครื่องจักร" },
  { key: "work_orders.view", label: "ดูใบสั่งงาน" },
  { key: "work_orders.create", label: "สร้างใบสั่งงาน" },
  { key: "work_orders.edit", label: "แก้ไขใบสั่งงาน" },
  { key: "work_orders.close", label: "ปิดใบสั่งงาน" },
  { key: "maintenance.view", label: "ดูแผนซ่อมบำรุง" },
  { key: "maintenance.create", label: "สร้างแผนซ่อมบำรุง" },
  { key: "maintenance.edit", label: "แก้ไขแผนซ่อมบำรุง" },
  { key: "spare_parts.view", label: "ดูอะไหล่" },
  { key: "spare_parts.create", label: "สร้าง/รับอะไหล่" },
  { key: "spare_parts.edit", label: "แก้ไขอะไหล่" },
  { key: "reports.view", label: "ดูรายงาน" },
  { key: "settings.view", label: "ดูการตั้งค่า" },
  { key: "settings.manage", label: "จัดการการตั้งค่า" },
  { key: "users.manage", label: "จัดการผู้ใช้งาน" },
]

export default function NewRolePage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [moduleAccess, setModuleAccess] = useState<ModuleAccessValue>("all")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const toggle = (key: string) =>
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }))

  const selectAll = () =>
    setPermissions(Object.fromEntries(PERMISSIONS.map(p => [p.key, true])))

  const clearAll = () => setPermissions({})

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError("กรุณากรอกชื่อ Role"); return }
    setError(null)
    setLoading(true)
    const res = await fetch("/api/settings/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), permissions, moduleAccess }),
    })
    setLoading(false)
    if (!res.ok) {
      const json = await res.json()
      setError(json.error?.message ?? "เกิดข้อผิดพลาด")
      return
    }
    router.push("/settings/roles")
    router.refresh()
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/settings/roles" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">เพิ่ม Role ใหม่</h1>
          <p className="text-slate-500 text-sm mt-0.5">กำหนดชื่อและสิทธิ์การเข้าถึง</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <Card>
          <CardHeader><CardTitle>ข้อมูล Role</CardTitle></CardHeader>
          <Input
            label="ชื่อ Role"
            required
            placeholder="เช่น Supervisor, Engineer"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </Card>

        <Card padding="none">
          <CardHeader>
            <CardTitle>สิทธิ์การเข้าถึง</CardTitle>
            <div className="flex gap-2">
              <button type="button" onClick={selectAll} className="text-xs text-blue-600 hover:text-blue-800">เลือกทั้งหมด</button>
              <span className="text-slate-300">|</span>
              <button type="button" onClick={clearAll} className="text-xs text-slate-500 hover:text-slate-700">ล้างทั้งหมด</button>
            </div>
          </CardHeader>
          <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PERMISSIONS.map(p => (
              <label key={p.key} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!permissions[p.key]}
                  onChange={() => toggle(p.key)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">{p.label}</span>
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>การเข้าถึงโมดูล</CardTitle>
          </CardHeader>
          <p className="text-xs text-slate-500 mb-4 -mt-2">
            กำหนดว่า Role นี้มองเห็นโมดูลใดใน sidebar และหน้า /apps (ต้องมีสิทธิ์ resource ด้วย)
          </p>
          <ModuleAccessPicker value={moduleAccess} onChange={setModuleAccess} />
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/settings/roles" className="px-4 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50">
            ยกเลิก
          </Link>
          <Button type="submit" loading={loading}>
            <Save className="w-4 h-4" />
            บันทึก Role
          </Button>
        </div>
      </form>
    </div>
  )
}
