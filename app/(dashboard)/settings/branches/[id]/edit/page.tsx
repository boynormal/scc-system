"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
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
  timezone: z.string().min(1, "กรุณากรอก Timezone"),
  isActive: z.boolean(),
})

type FormData = z.infer<typeof schema>

export default function EditBranchPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    fetch(`/api/settings/branches/${id}`)
      .then((r) => r.json())
      .then(({ data, error: err }) => {
        if (err || !data) {
          setLoadError(typeof err === "string" ? err : "ไม่พบสาขา")
          return
        }
        reset({
          code: data.code,
          name: data.name,
          address: data.address ?? "",
          timezone: data.timezone,
          isActive: data.isActive,
        })
      })
      .catch(() => setLoadError("ไม่สามารถโหลดข้อมูลสาขาได้"))
      .finally(() => setFetching(false))
  }, [id, reset])

  const onSubmit = async (data: FormData) => {
    setError(null)
    const res = await fetch(`/api/settings/branches/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      setError(json?.error?.message ?? json?.error ?? "เกิดข้อผิดพลาด")
      return
    }
    router.push("/settings/branches")
    router.refresh()
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
        กำลังโหลด...
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-4 max-w-xl">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{loadError}</div>
        <Link href="/settings/branches" className="text-sm text-blue-600 hover:underline">← กลับไปหน้าสาขา</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <Link href="/settings/branches" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">แก้ไขสาขา</h1>
          <p className="text-slate-500 text-sm mt-0.5">แก้ไขข้อมูลสาขาหรือโรงงานในเครือบริษัท</p>
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
              error={errors.timezone?.message}
              {...register("timezone")}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">สถานะ</label>
              <label className="flex items-center gap-3 cursor-pointer h-[38px]">
                <input type="checkbox" {...register("isActive")} className="w-4 h-4 rounded text-blue-600" />
                <span className="text-sm text-slate-700">เปิดใช้งานสาขานี้</span>
              </label>
            </div>
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
            บันทึกการแก้ไข
          </Button>
        </div>
      </form>
    </div>
  )
}
