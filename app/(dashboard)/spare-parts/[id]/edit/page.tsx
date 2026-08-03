"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Save, Loader2, Trash2 } from "lucide-react"
import Link from "next/link"
import { ImageUpload } from "@/components/ui/image-upload"
import { GlassButton, GlassCard, GlassCardHeader, GlassCardTitle, GlassInput } from "@/components/glass"
import { useTypeConfirm } from "@/components/ui/type-confirm"

const schema = z.object({
  code: z.string().min(1, "กรุณากรอกรหัสอะไหล่").max(50),
  name: z.string().min(1, "กรุณากรอกชื่ออะไหล่").max(255),
  description: z.string().optional(),
  unit: z.string().min(1, "กรุณากรอกหน่วย").max(20),
  unitCost: z.coerce.number().min(0),
  minStock: z.coerce.number().int().min(0),
  leadTimeDays: z.coerce.number().int().min(0),
  supplierId: z.string().uuid().optional().or(z.literal("")),
})

type FormData = z.infer<typeof schema>

export default function EditSparePartPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const confirmType = useTypeConfirm()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [partName, setPartName] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    Promise.all([
      fetch(`/api/spare-parts/${id}`).then((r) => r.json()),
      fetch("/api/master-data/suppliers").then((r) => r.json()),
    ]).then(([p, s]) => {
      setSuppliers(s.data ?? [])
      if (p.data) {
        const part = p.data
        setPartName(part.name)
        setImageUrl(part.imageUrl ?? "")
        reset({
          code: part.code,
          name: part.name,
          description: part.description ?? "",
          unit: part.unit,
          unitCost: Number(part.unitCost),
          minStock: part.minStock,
          leadTimeDays: part.leadTimeDays,
          supplierId: part.supplierId ?? "",
        })
      }
      setLoading(false)
    }).catch(() => { setError("ไม่สามารถโหลดข้อมูลได้"); setLoading(false) })
  }, [id, reset])

  const onSubmit = async (data: FormData) => {
    setError(null)
    const res = await fetch(`/api/spare-parts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, imageUrl: imageUrl || null, supplierId: data.supplierId || null }),
    })
    if (res.ok) {
      router.push("/spare-parts")
      router.refresh()
    } else {
      const json = await res.json()
      setError(json.error?.message ?? "เกิดข้อผิดพลาด")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/spare-parts" className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">แก้ไขอะไหล่</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{partName}</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <GlassCard>
          <GlassCardHeader><GlassCardTitle>ข้อมูลอะไหล่</GlassCardTitle></GlassCardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassInput label="รหัสอะไหล่" required error={errors.code?.message} {...register("code")} />
            <GlassInput label="ชื่ออะไหล่" required error={errors.name?.message} {...register("name")} />
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">รายละเอียด</label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                {...register("description")}
              />
            </div>
            <GlassInput label="หน่วย" required error={errors.unit?.message} {...register("unit")} />
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">ซัพพลายเออร์</label>
              <select
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-card"
                {...register("supplierId")}
              >
                <option value="">— ไม่ระบุ —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader><GlassCardTitle>รูปภาพอะไหล่</GlassCardTitle></GlassCardHeader>
          <ImageUpload value={imageUrl} onChange={setImageUrl} />
        </GlassCard>

        <GlassCard>
          <GlassCardHeader><GlassCardTitle>ราคาและสต็อก</GlassCardTitle></GlassCardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <GlassInput label="ราคาต่อหน่วย (฿)" type="number" min={0} step={0.01} error={errors.unitCost?.message} {...register("unitCost")} />
            <GlassInput label="สต็อกขั้นต่ำ" type="number" min={0} error={errors.minStock?.message} {...register("minStock")} />
            <GlassInput label="Lead Time (วัน)" type="number" min={0} error={errors.leadTimeDays?.message} {...register("leadTimeDays")} />
          </div>
        </GlassCard>

        <div className="flex gap-3 justify-between">
          <GlassButton
            type="button"
            variant="danger"
            icon={<Trash2 className="w-4 h-4" />}
            onClick={async () => {
              const ok = await confirmType({ message: "ต้องการปิดใช้งานอะไหล่นี้?" })
              if (!ok) return
              await fetch(`/api/spare-parts/${id}`, { method: "DELETE" })
              router.push("/spare-parts")
              router.refresh()
            }}
          >
            ปิดใช้งาน
          </GlassButton>
          <div className="flex gap-3">
            <Link href="/spare-parts" className="px-4 py-2 border border-border text-muted-foreground text-sm font-medium rounded-lg hover:bg-muted/60">
              ยกเลิก
            </Link>
            <GlassButton type="submit" loading={isSubmitting} icon={<Save className="w-4 h-4" />}>
              บันทึกการแก้ไข
            </GlassButton>
          </div>
        </div>
      </form>
    </div>
  )
}
