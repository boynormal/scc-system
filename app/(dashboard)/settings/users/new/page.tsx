"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"

const schema = z.object({
  employeeCode: z.string().optional(),
  firstName: z.string().min(1, "กรุณากรอกชื่อ"),
  lastName: z.string().min(1, "กรุณากรอกนามสกุล"),
  email: z.string().email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านอย่างน้อย 8 ตัวอักษร"),
  phone: z.string().optional(),
  branchId: z.string().uuid("กรุณาเลือกสาขา"),
  roleId: z.string().uuid("กรุณาเลือก Role"),
})

type FormData = z.infer<typeof schema>

export default function NewUserPage() {
  const router = useRouter()
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([])
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    fetch("/api/master-data/branches").then((r) => r.json()).then((d) => setBranches(d.data ?? []))
    fetch("/api/master-data/roles").then((r) => r.json()).then((d) => setRoles(d.data ?? []))
  }, [])

  const onSubmit = async (data: FormData) => {
    setError(null)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
        <Link href="/settings/users" className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">เพิ่มผู้ใช้งาน</h1>
          <p className="text-slate-500 text-sm mt-0.5">สร้างบัญชีผู้ใช้งานใหม่ในระบบ</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Card>
          <CardHeader><CardTitle>ข้อมูลส่วนตัว</CardTitle></CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="ชื่อ" required error={errors.firstName?.message} {...register("firstName")} />
            <Input label="นามสกุล" required error={errors.lastName?.message} {...register("lastName")} />
            <Input label="รหัสพนักงาน" placeholder="เช่น EMP002" {...register("employeeCode")} />
            <Input label="เบอร์โทรศัพท์" type="tel" {...register("phone")} />
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>ข้อมูลเข้าสู่ระบบ</CardTitle></CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="อีเมล"
              required
              type="email"
              placeholder="user@company.com"
              error={errors.email?.message}
              {...register("email")}
            />
            <Input
              label="รหัสผ่าน"
              required
              type="password"
              hint="อย่างน้อย 8 ตัวอักษร"
              error={errors.password?.message}
              {...register("password")}
            />
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>สิทธิ์การเข้าถึง</CardTitle></CardHeader>
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
            สร้างผู้ใช้งาน
          </Button>
        </div>
      </form>
    </div>
  )
}
