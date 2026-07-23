"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"

const schema = z.object({
  code: z.string().min(1, "กรุณากรอกรหัสสาขา").max(20),
  name: z.string().min(1, "กรุณากรอกชื่อสาขา").max(255),
  address: z.string().optional(),
  timezone: z.string().default("Asia/Bangkok"),
})

type FormData = z.infer<typeof schema>

export default function NewBranchPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { timezone: "Asia/Bangkok" },
  })

  const onSubmit = async (data: FormData) => {
    setError(null)
    const res = await fetch("/api/settings/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const json = await res.json()
      setError(json.error?.message ?? "เกิดข้อผิดพลาด")
      return
    }
    router.push("/settings/branches")
    router.refresh()
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <Link href="/settings/branches" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">เพิ่มสาขาใหม่</h1>
          <p className="text-slate-500 text-sm mt-0.5">สร้างสาขาหรือโรงงานในเครือบริษัท</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Card>
          <CardHeader><CardTitle>ข้อมูลสาขา</CardTitle></CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="รหัสสาขา"
              required
              placeholder="เช่น HQ, BKK01"
              error={errors.code?.message}
              {...register("code")}
            />
            <Input
              label="ชื่อสาขา"
              required
              placeholder="เช่น สำนักงานใหญ่"
              error={errors.name?.message}
              {...register("name")}
            />
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">ที่อยู่</label>
              <textarea
                rows={3}
                placeholder="ที่อยู่สาขา..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                {...register("address")}
              />
            </div>
            <Input
              label="Timezone"
              placeholder="Asia/Bangkok"
              {...register("timezone")}
            />
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Link
            href="/settings/branches"
            className="px-4 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50"
          >
            ยกเลิก
          </Link>
          <Button type="submit" loading={isSubmitting}>
            <Save className="w-4 h-4" />
            บันทึกสาขา
          </Button>
        </div>
      </form>
    </div>
  )
}
