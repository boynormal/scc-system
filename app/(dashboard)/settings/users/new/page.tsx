"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { GlassButton, GlassCard, GlassCardHeader, GlassCardTitle, GlassInput } from "@/components/glass"
import { ModuleAccessPicker, type ModuleAccessValue } from "@/components/settings/module-access-picker"
import { UserEffectiveAccessSummary } from "@/components/settings/user-effective-access-summary"
import {
  BranchAssignmentsEditor,
  emptyAssignmentRow,
  type BranchAssignmentRow,
} from "@/components/settings/branch-assignments-editor"

const schema = z.object({
  employeeCode: z.string().optional(),
  firstName: z.string().min(1, "กรุณากรอกชื่อ"),
  lastName: z.string().min(1, "กรุณากรอกนามสกุล"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._]{3,50}$/, "Username ต้องเป็น a-z, 0-9, . หรือ _ ความยาว 3–50 ตัว"),
  email: z.string().email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร"),
  phone: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function NewUserPage() {
  const router = useRouter()
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([])
  const [assignments, setAssignments] = useState<BranchAssignmentRow[]>([emptyAssignmentRow()])
  const [moduleAccess, setModuleAccess] = useState<ModuleAccessValue>(null)
  const [error, setError] = useState<string | null>(null)
  const [assignmentError, setAssignmentError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const summaryRoleId = assignments.find((r) => r.roleId)?.roleId
  const mixedRoles = new Set(assignments.map((r) => r.roleId).filter(Boolean)).size > 1

  useEffect(() => {
    Promise.all([
      fetch("/api/master-data/branches").then((r) => r.json()),
      fetch("/api/master-data/roles").then((r) => r.json()),
    ]).then(([brRes, roleRes]) => {
      const branchList = brRes.data ?? []
      const roleList = roleRes.data ?? []
      setBranches(branchList)
      setRoles(roleList)
      setAssignments([emptyAssignmentRow({ branchId: branchList[0]?.id, roleId: roleList[0]?.id })])
    })
  }, [])

  const onSubmit = async (data: FormData) => {
    setError(null)
    setAssignmentError(null)
    const branchAssignments = assignments
      .filter((r) => r.branchId && r.roleId)
      .map((r) => ({ branchId: r.branchId, roleId: r.roleId }))
    if (branchAssignments.length === 0) {
      setAssignmentError("ต้องมีสิทธิ์อย่างน้อย 1 สาขา")
      return
    }
    const seen = new Set<string>()
    for (const row of branchAssignments) {
      if (seen.has(row.branchId)) {
        setAssignmentError("ไม่สามารถกำหนด Role ซ้ำในสาขาเดียวกันได้")
        return
      }
      seen.add(row.branchId)
    }

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, moduleAccess, branchAssignments }),
      })
      if (res.ok) {
        router.push("/settings/users")
        router.refresh()
      } else {
        const body = await res.json().catch(() => null)
        setError(body?.error?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่")
      }
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่")
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings/users" className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">เพิ่มผู้ใช้งาน</h1>
          <p className="text-muted-foreground text-sm mt-0.5">สร้างบัญชีผู้ใช้งานใหม่ในระบบ</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="space-y-5">
        <GlassCard>
          <GlassCardHeader><GlassCardTitle>ข้อมูลส่วนตัว</GlassCardTitle></GlassCardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassInput label="ชื่อ" required error={errors.firstName?.message} {...register("firstName")} />
            <GlassInput label="นามสกุล" required error={errors.lastName?.message} {...register("lastName")} />
            <GlassInput label="รหัสพนักงาน" placeholder="เช่น EMP002" {...register("employeeCode")} />
            <GlassInput label="เบอร์โทรศัพท์" type="tel" {...register("phone")} />
          </div>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader><GlassCardTitle>ข้อมูลเข้าสู่ระบบ</GlassCardTitle></GlassCardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassInput
              label="ชื่อผู้ใช้ (Username)"
              required
              placeholder="เช่น somchai"
              hint="ใช้เข้าสู่ระบบได้ — a-z, 0-9, . หรือ _"
              autoComplete="off"
              error={errors.username?.message}
              {...register("username")}
            />
            <GlassInput
              label="อีเมล"
              required
              type="email"
              placeholder="user@company.com"
              hint="ใช้เข้าสู่ระบบหรือติดต่อได้"
              autoComplete="off"
              error={errors.email?.message}
              {...register("email")}
            />
            <GlassInput
              label="รหัสผ่าน"
              required
              type="password"
              hint="อย่างน้อย 8 ตัวอักษร"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register("password")}
            />
          </div>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader><GlassCardTitle>สาขาและ Role</GlassCardTitle></GlassCardHeader>
          <p className="text-xs text-muted-foreground -mt-2 mb-4">
            สิทธิ์อ่าน/เขียนมาจาก Role ของแต่ละสาขา — ผู้ใช้งานการเงินที่ดูแลหลายสาขาให้เพิ่มสาขาที่นี่ ไม่ต้องเป็น Admin
          </p>
          <BranchAssignmentsEditor
            rows={assignments}
            onChange={setAssignments}
            branches={branches}
            roles={roles}
            error={assignmentError ?? undefined}
          />
          {mixedRoles && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
              Role ไม่เหมือนกันทุกสาขา — สรุปด้านล่างแสดง Role แถวแรก
            </p>
          )}
          <div className="mt-4">
            <UserEffectiveAccessSummary roleId={summaryRoleId} moduleAccess={moduleAccess} />
          </div>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader><GlassCardTitle>การมองเห็นโมดูล</GlassCardTitle></GlassCardHeader>
          <p className="text-xs text-muted-foreground mb-4 -mt-2">
            สิทธิ์อ่าน/เขียนมาจาก Role — ที่นี่ปรับแค่การมองเห็นโมดูล (override ได้เมื่อจำเป็น)
          </p>
          <ModuleAccessPicker value={moduleAccess} onChange={setModuleAccess} allowInherit />
        </GlassCard>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Link href="/settings/users" className="px-5 py-2 border border-border text-muted-foreground text-sm font-medium rounded-lg hover:bg-muted/60 transition-colors">
            ยกเลิก
          </Link>
          <GlassButton type="submit" loading={isSubmitting} icon={<Save className="w-4 h-4" />}>
            สร้างผู้ใช้งาน
          </GlassButton>
        </div>
      </form>
    </div>
  )
}
