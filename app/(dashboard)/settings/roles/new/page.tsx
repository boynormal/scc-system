"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import { GlassButton, GlassCard, GlassCardHeader, GlassCardTitle, GlassInput } from "@/components/glass"
import Link from "next/link"
import { RolePermissionMatrix } from "@/components/settings/role-permission-matrix"
import { allMatrixFormState, emptyMatrixFormState } from "@/shared/permissions/role-matrix"

export default function NewRolePage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [permissions, setPermissions] = useState<Record<string, boolean>>(() => emptyMatrixFormState())
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError("กรุณากรอกชื่อ Role")
      return
    }
    setError(null)
    setLoading(true)
    const res = await fetch("/api/settings/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), permissions }),
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
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings/roles" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">เพิ่ม Role ใหม่</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            กำหนดสิทธิ์อ่าน/เขียนต่อทรัพยากร — เมนูจะแสดงตามสิทธิ์อ่าน
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle>ข้อมูล Role</GlassCardTitle>
          </GlassCardHeader>
          <GlassInput
            label="ชื่อ Role"
            required
            placeholder="เช่น Supervisor, Engineer"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </GlassCard>

        <GlassCard padding="none">
          <GlassCardHeader className="px-5 pt-5">
            <GlassCardTitle>สิทธิ์การเข้าถึงข้อมูล (CRUD)</GlassCardTitle>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPermissions(allMatrixFormState(true))}
                className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                เลือกทั้งหมด
              </button>
              <span className="text-muted-foreground">|</span>
              <button
                type="button"
                onClick={() => setPermissions(emptyMatrixFormState())}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ล้างทั้งหมด
              </button>
            </div>
          </GlassCardHeader>
          <p className="mb-3 px-5 text-xs text-muted-foreground">
            ควบคุมว่า Role นี้ทำอะไรกับข้อมูลได้บ้าง — มีสิทธิ์อ่านของทรัพยากรใด เมนูนั้นจะแสดง
          </p>
          <RolePermissionMatrix value={permissions} onChange={setPermissions} />
        </GlassCard>

        <div className="flex justify-end gap-3">
          <Link
            href="/settings/roles"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/60"
          >
            ยกเลิก
          </Link>
          <GlassButton type="submit" loading={loading} icon={<Save className="h-4 w-4" />}>
            บันทึก Role
          </GlassButton>
        </div>
      </form>
    </div>
  )
}
