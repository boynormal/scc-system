"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { ImageUpload } from "@/components/ui/image-upload"

const schema = z.object({
  code: z.string().min(1, "กรุณากรอกรหัสอะไหล่").max(50),
  name: z.string().min(1, "กรุณากรอกชื่ออะไหล่").max(255),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  unit: z.string().min(1, "กรุณากรอกหน่วย").max(20),
  unitCost: z.coerce.number().min(0).default(0),
  minStock: z.coerce.number().int().min(0).default(0),
  leadTimeDays: z.coerce.number().int().min(0).default(0),
  supplierId: z.string().uuid().optional().or(z.literal("")),
})

type FormData = z.infer<typeof schema>

export default function NewSparePartPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])
  const [imageUrl, setImageUrl] = useState("")

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { unitCost: 0, minStock: 0, leadTimeDays: 0 },
  })

  useEffect(() => {
    fetch("/api/master-data/suppliers").then(r => r.json()).then(j => setSuppliers(j.data ?? []))
  }, [])

  const onSubmit = async (data: FormData) => {
    setError(null)
    const payload = { ...data, imageUrl, supplierId: data.supplierId || undefined }
    const res = await fetch("/api/spare-parts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const json = await res.json()
      setError(json.error?.message ?? "เกิดข้อผิดพลาด")
      return
    }
    router.push("/spare-parts")
    router.refresh()
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/spare-parts" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">เพิ่มอะไหล่ใหม่</h1>
          <p className="text-slate-500 text-sm mt-0.5">ลงทะเบียนอะไหล่ในระบบคลัง</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Card>
          <CardHeader><CardTitle>ข้อมูลอะไหล่</CardTitle></CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="รหัสอะไหล่"
              required
              placeholder="เช่น SP-001"
              error={errors.code?.message}
              {...register("code")}
            />
            <Input
              label="ชื่ออะไหล่"
              required
              placeholder="เช่น ตลับลูกปืน SKF 6205"
              error={errors.name?.message}
              {...register("name")}
            />
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">รายละเอียด</label>
              <textarea
                rows={2}
                placeholder="รายละเอียดเพิ่มเติม..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                {...register("description")}
              />
            </div>
            <Input
              label="หน่วย"
              required
              placeholder="เช่น ชิ้น, เมตร, กล่อง"
              error={errors.unit?.message}
              {...register("unit")}
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">ซัพพลายเออร์</label>
              <select
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                {...register("supplierId")}
              >
                <option value="">— ไม่ระบุ —</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>รูปภาพอะไหล่</CardTitle></CardHeader>
          <ImageUpload value={imageUrl} onChange={setImageUrl} />
        </Card>

        <Card>
          <CardHeader><CardTitle>ราคาและสต็อก</CardTitle></CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="ราคาต่อหน่วย (฿)"
              type="number"
              min={0}
              step={0.01}
              error={errors.unitCost?.message}
              {...register("unitCost")}
            />
            <Input
              label="สต็อกขั้นต่ำ"
              type="number"
              min={0}
              error={errors.minStock?.message}
              {...register("minStock")}
            />
            <Input
              label="Lead Time (วัน)"
              type="number"
              min={0}
              error={errors.leadTimeDays?.message}
              {...register("leadTimeDays")}
            />
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/spare-parts" className="px-4 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50">
            ยกเลิก
          </Link>
          <Button type="submit" loading={isSubmitting}>
            <Save className="w-4 h-4" />
            บันทึกอะไหล่
          </Button>
        </div>
      </form>
    </div>
  )
}
