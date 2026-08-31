"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
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
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._]{3,50}$/, "Username ต้องเป็น a-z, 0-9, . หรือ _ ความยาว 3–50 ตัว"),
  email: z.string().email("อีเมลไม่ถูกต้อง"),
  employeeCode: z.string().optional(),
  firstName: z.string().min(1, "กรุณากรอกชื่อ"),
  lastName: z.string().min(1, "กรุณากรอกนามสกุล"),
  phone: z.string().optional(),
  isActive: z.boolean(),
  password: z.string().min(8).optional().or(z.literal("")),
})

type FormData = z.infer<typeof schema>

export default function EditUserPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [error, setError] = useState<string | null>(null)
  const [assignmentError, setAssignmentError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState("")
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([])
  const [assignments, setAssignments] = useState<BranchAssignmentRow[]>([emptyAssignmentRow()])
  const [moduleAccess, setModuleAccess] = useState<ModuleAccessValue>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const summaryRoleId = assignments.find((r) => r.roleId)?.roleId
  const mixedRoles = new Set(assignments.map((r) => r.roleId).filter(Boolean)).size > 1

  useEffect(() => {
    Promise.all([
      fetch(`/api/users/${id}`).then((r) => r.json()),
      fetch("/api/master-data/branches").then((r) => r.json()),
      fetch("/api/master-data/roles").then((r) => r.json()),
    ]).then(([userRes, brRes, roleRes]) => {
      const data = userRes.data
      const branchList = brRes.data ?? []
      const roleList = roleRes.data ?? []
      setBranches(branchList)
      setRoles(roleList)

      if (data) {
        setDisplayName(`${data.firstName} ${data.lastName}`)
        const ubr = (data.userBranchRoles ?? []) as {
          id: string
          branch: { id: string }
          role: { id: string }
        }[]
        setAssignments(
          ubr.length
            ? ubr.map((row) => ({
                key: row.id,
                id: row.id,
                branchId: row.branch.id,
                roleId: row.role.id,
              }))
            : [emptyAssignmentRow({ branchId: branchList[0]?.id, roleId: roleList[0]?.id })]
        )
        const ma = data.moduleAccess
        setModuleAccess(ma === "all" || Array.isArray(ma) ? (ma as ModuleAccessValue) : null)
        reset({
          username: data.username,
          email: data.email,
          employeeCode: data.employeeCode ?? "",
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone ?? "",
          isActive: data.isActive,
          password: "",
        })
      }
      setLoading(false)
    })
  }, [id, reset])

  const onSubmit = async (data: FormData) => {
    setError(null)
    setAssignmentError(null)
    const uuid = /^[0-9a-f-]{36}$/i
    const branchAssignments = assignments
      .filter((r) => r.branchId && r.roleId)
      .map((r) => ({
        ...(r.id && uuid.test(r.id) ? { id: r.id } : {}),
        branchId: r.branchId,
        roleId: r.roleId,
      }))
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

    const payload = {
      ...data,
      password: data.password || undefined,
      moduleAccess,
      branchAssignments,
    }
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings/users" className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">แก้ไขผู้ใช้งาน</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{displayName}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <GlassCard>
          <GlassCardHeader><GlassCardTitle>ข้อมูลส่วนตัว</GlassCardTitle></GlassCardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassInput
              label="ชื่อผู้ใช้ (Username)"
              required
              hint="ใช้เข้าสู่ระบบได้ — a-z, 0-9, . หรือ _"
              autoComplete="off"
              error={errors.username?.message}
              {...register("username")}
            />
            <GlassInput
              label="อีเมล"
              required
              type="email"
              hint="ใช้เข้าสู่ระบบหรือติดต่อได้"
              error={errors.email?.message}
              {...register("email")}
            />
            <GlassInput
              label="รหัสพนักงาน"
              placeholder="เช่น EMP002"
              autoComplete="off"
              {...register("employeeCode")}
            />
            <GlassInput label="เบอร์โทรศัพท์" type="tel" autoComplete="off" {...register("phone")} />
            <GlassInput label="ชื่อ" required error={errors.firstName?.message} {...register("firstName")} />
            <GlassInput label="นามสกุล" required error={errors.lastName?.message} {...register("lastName")} />
          </div>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader><GlassCardTitle>สถานะและรหัสผ่าน</GlassCardTitle></GlassCardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">สถานะ</label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" {...register("isActive")} className="w-4 h-4 rounded text-blue-600" />
                <span className="text-sm text-foreground">เปิดการใช้งาน</span>
              </label>
            </div>
            <GlassInput
              label="รหัสผ่านใหม่"
              type="password"
              hint="เว้นว่างหากไม่ต้องการเปลี่ยน"
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
            บันทึกการแก้ไข
          </GlassButton>
        </div>
      </form>
    </div>
  )
}
