"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Save } from "lucide-react"
import { GlassButton, GlassCard, GlassCardHeader, GlassCardTitle, GlassInput } from "@/components/glass"
import Link from "next/link"
import { RolePermissionMatrix } from "@/components/settings/role-permission-matrix"
import {
  allMatrixFormState,
  emptyMatrixFormState,
  storedToMatrixForm,
} from "@/shared/permissions/role-matrix"

export default function EditRolePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const roleId = params.id

  const [name, setName] = useState("")
  const [permissions, setPermissions] = useState<Record<string, boolean>>(() => emptyMatrixFormState())
  const [isSystem, setIsSystem] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    fetch(`/api/settings/roles/${roleId}`)
      .then((r) => r.json())
      .then(({ data, error: err }) => {
        if (err || !data) {
          setLoadError(err ?? "ไม่พบ Role")
          return
        }
        const stored = data.permissions as Record<string, unknown> | null
        setName(data.name)
        setIsSystem(data.isSystem)
        setPermissions(storedToMatrixForm(stored, data.name))
      })
      .catch(() => setLoadError("ไม่สามารถโหลด Role ได้"))
      .finally(() => setFetching(false))
  }, [roleId])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError("กรุณากรอกชื่อ Role")
      return
    }
    setError(null)
    setLoading(true)
    const res = await fetch(`/api/settings/roles/${roleId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), permissions }),
    })
    setLoading(false)
    if (!res.ok) {
      const json = await res.json()
      setError(json.error?.message ?? json.error ?? "เกิดข้อผิดพลาด")
      return
    }
    router.push("/settings/roles")
    router.refresh()
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        กำลังโหลด...
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {loadError}
        </div>
        <Link href="/settings/roles" className="text-sm text-blue-600 hover:underline">
          ← กลับไปหน้าสิทธิ์
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings/roles" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">แก้ไข Role</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isSystem
              ? "System Role — แก้สิทธิ์ CRUD ได้ แต่เปลี่ยนชื่อหรือลบไม่ได้"
              : "แก้ไขชื่อและสิทธิ์ CRUD — เมนูจะแสดงตามสิทธิ์อ่าน"}
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
            disabled={isSystem}
          />
          {isSystem && (
            <p className="mt-2 text-xs text-muted-foreground">ชื่อ System Role ถูกล็อกไว้</p>
          )}
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
            บันทึก
          </GlassButton>
        </div>
      </form>
    </div>
  )
}
