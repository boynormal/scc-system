"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { ModuleAccessPicker, type ModuleAccessValue } from "@/components/settings/module-access-picker"

const schema = z.object({
  firstName: z.string().min(1, "กรุณากรอกชื่อ"),
  lastName: z.string().min(1, "กรุณากรอกนามสกุล"),
  phone: z.string().optional(),
  isActive: z.boolean(),
  password: z.string().min(8).optional().or(z.literal("")),
  branchId: z.string().uuid("กรุณาเลือกสาขา"),
  roleId: z.string().uuid("กรุณาเลือก Role"),
})

type FormData = z.infer<typeof schema>

export default function EditUserPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState("")
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([])
  const [userBranchRoleId, setUserBranchRoleId] = useState<string | undefined>(undefined)
  const [moduleAccess, setModuleAccess] = useState<ModuleAccessValue>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

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
        const firstUbr = data.userBranchRoles?.[0] as
          | { id: string; branch: { id: string }; role: { id: string } }
          | undefined
        const defaultBranchId = firstUbr?.branch.id ?? branchList[0]?.id ?? ""
        const defaultRoleId = firstUbr?.role.id ?? roleList[0]?.id ?? ""
        setUserBranchRoleId(firstUbr?.id)
        const ma = data.moduleAccess
        setModuleAccess(ma === "all" || Array.isArray(ma) ? (ma as ModuleAccessValue) : null)
        reset({
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone ?? "",
          isActive: data.isActive,
          password: "",
          branchId: defaultBranchId,
          roleId: defaultRoleId,
        })
      }
      setLoading(false)
    })
  }, [id, reset])

  const onSubmit = async (data: FormData) => {
    setError(null)
    const payload = { ...data, password: data.password || undefined, userBranchRoleId, moduleAccess }
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
        <Link href="/settings/users" className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">แก้ไขผู้ใช้งาน</h1>
          <p className="text-slate-500 text-sm mt-0.5">{displayName}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Card>
          <CardHeader><CardTitle>ข้อมูลส่วนตัว</CardTitle></CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="ชื่อ" required error={errors.firstName?.message} {...register("firstName")} />
            <Input label="นามสกุล" required error={errors.lastName?.message} {...register("lastName")} />
            <Input label="เบอร์โทรศัพท์" type="tel" {...register("phone")} />
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>สิทธิ์การเข้าถึง</CardTitle></CardHeader>
          <p className="text-xs text-slate-500 -mt-2 mb-4">
            สาขาและ Role ใช้ตรวจสิทธิ์ในระบบ (เช่น แก้ไขเครื่อง BOM) — บันทึกแล้วควรให้ผู้ใช้ออกจากระบบแล้วเข้าใหม่เพื่ออัปเดตสิทธิ์ทันที
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="สาขา"
              required
              placeholder="เลือกสาขา"
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
              error={errors.branchId?.message}
              {...register("branchId")}
            />
            <Select
              label="Role"
              required
              placeholder="เลือก Role"
              options={roles.map((r) => ({ value: r.id, label: r.name }))}
              error={errors.roleId?.message}
              {...register("roleId")}
            />
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>สถานะและรหัสผ่าน</CardTitle></CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">สถานะ</label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" {...register("isActive")} className="w-4 h-4 rounded text-blue-600" />
                <span className="text-sm text-slate-700">เปิดการใช้งาน</span>
              </label>
            </div>
            <Input
              label="รหัสผ่านใหม่"
              type="password"
              hint="เว้นว่างหากไม่ต้องการเปลี่ยน"
              error={errors.password?.message}
              {...register("password")}
            />
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>การมองเห็นโมดูล</CardTitle></CardHeader>
          <p className="text-xs text-slate-500 mb-4 -mt-2">
            ค่าเริ่มต้นใช้ตาม Role ที่เลือกด้านบน — เลือก override ที่นี่เฉพาะเมื่อต้องการให้ผู้ใช้คนนี้เห็นโมดูลต่างจากคนอื่นที่ Role เดียวกัน
          </p>
          <ModuleAccessPicker value={moduleAccess} onChange={setModuleAccess} allowInherit />
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Link href="/settings/users" className="px-5 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            ยกเลิก
          </Link>
          <Button type="submit" loading={isSubmitting} icon={<Save className="w-4 h-4" />}>
            บันทึกการแก้ไข
          </Button>
        </div>
      </form>
    </div>
  )
}
