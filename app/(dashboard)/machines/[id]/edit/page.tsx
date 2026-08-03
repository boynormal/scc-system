"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Save, Trash2 } from "lucide-react"
import Link from "next/link"
import { Select } from "@/components/ui/select"
import { MultiImageUpload } from "@/components/ui/multi-image-upload"
import { ProductsListEditor } from "@/components/ui/products-list-editor"
import { GlassButton, GlassCard, GlassCardHeader, GlassCardTitle, GlassInput } from "@/components/glass"
import { useTypeConfirm } from "@/components/ui/type-confirm"

const schema = z.object({
  branchId: z.string().uuid(),
  departmentId: z.string().optional(),
  categoryId: z.string().uuid(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  serialNumber: z.string().optional(),
  installDate: z.string().optional(),
  warrantyExpireDate: z.string().optional(),
  criticalLevel: z.coerce.number().int().min(1).max(4),
  locationDetail: z.string().optional(),
  machineType: z.string().optional(),
  description: z.string().optional(),
  pmGeneral: z.string().optional(),
  pmMajor: z.string().optional(),
  status: z.enum(["active", "inactive", "under_maintenance", "decommissioned"]),
})

type FormData = z.infer<typeof schema>

function toDateInput(d: string | Date | null | undefined): string {
  if (!d) return ""
  const date = d instanceof Date ? d : new Date(d)
  return date.toISOString().split("T")[0]
}

export default function EditMachinePage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const confirmType = useTypeConfirm()
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [machineName, setMachineName] = useState("")
  const [images, setImages] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const selectedBranchId = watch("branchId")

  useEffect(() => {
    Promise.all([
      fetch("/api/master-data/branches").then((r) => r.json()),
      fetch("/api/master-data/categories").then((r) => r.json()),
      fetch(`/api/machines/${id}`).then((r) => r.json()),
      fetch(`/api/machines/${id}/images`).then((r) => r.json()),
      fetch(`/api/machines/${id}/products`).then((r) => r.json()),
    ]).then(([b, c, m, img, prod]) => {
      setBranches(b.data ?? [])
      setCategories(c.data ?? [])
      setImages(img.data ?? [])
      setProducts(prod.data ?? [])
      if (m.data) {
        const machine = m.data
        setMachineName(machine.name)
        reset({
          branchId: machine.branchId,
          departmentId: machine.departmentId ?? "",
          categoryId: machine.categoryId,
          code: machine.code,
          name: machine.name,
          model: machine.model ?? "",
          manufacturer: machine.manufacturer ?? "",
          serialNumber: machine.serialNumber ?? "",
          installDate: toDateInput(machine.installDate),
          warrantyExpireDate: toDateInput(machine.warrantyExpireDate),
          criticalLevel: machine.criticalLevel,
          locationDetail: machine.locationDetail ?? "",
          machineType: machine.machineType ?? "",
          description: machine.description ?? "",
          pmGeneral: machine.pmGeneral ?? "",
          pmMajor: machine.pmMajor ?? "",
          status: machine.status,
        })
      }
      setLoading(false)
    })
  }, [id, reset])

  useEffect(() => {
    if (selectedBranchId) {
      fetch(`/api/master-data/departments?branchId=${selectedBranchId}`)
        .then((r) => r.json())
        .then((d) => setDepartments(d.data ?? []))
    }
  }, [selectedBranchId])

  const onSubmit = async (data: FormData) => {
    setError(null)
    const res = await fetch(`/api/machines/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      router.push(`/machines/${id}`)
      router.refresh()
    } else {
      const body = await res.json()
      setError(body.error?.message ?? "เกิดข้อผิดพลาด")
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
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/machines/${id}`} className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">แก้ไขเครื่องจักร</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{machineName}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <GlassCard>
          <GlassCardHeader><GlassCardTitle>สถานะและตำแหน่ง</GlassCardTitle></GlassCardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="สถานะ"
              required
              options={[
                { value: "active", label: "ใช้งาน" },
                { value: "under_maintenance", label: "กำลังซ่อมบำรุง" },
                { value: "inactive", label: "ไม่ใช้งาน" },
                { value: "decommissioned", label: "ปลดระวาง" },
              ]}
              {...register("status")}
            />
            <Select
              label="สาขา"
              required
              placeholder="เลือกสาขา"
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
              error={errors.branchId?.message}
              {...register("branchId")}
            />
            <Select
              label="แผนก"
              placeholder="เลือกแผนก"
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
              {...register("departmentId")}
            />
            <Select
              label="หมวดหมู่"
              required
              placeholder="เลือกหมวดหมู่"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              error={errors.categoryId?.message}
              {...register("categoryId")}
            />
            <GlassInput label="ตำแหน่งในโรงงาน" placeholder="เช่น อาคาร A ชั้น 1" {...register("locationDetail")} />
            <GlassInput label="ประเภทเครื่องจักร" placeholder="เช่น CNC, Conveyor, Compressor" {...register("machineType")} />
            <Select
              label="ระดับความเสี่ยง"
              options={[
                { value: "1", label: "1 — ต่ำ" },
                { value: "2", label: "2 — ปานกลาง" },
                { value: "3", label: "3 — สูง" },
                { value: "4", label: "4 — วิกฤต" },
              ]}
              {...register("criticalLevel")}
            />
          </div>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader><GlassCardTitle>ข้อมูลพื้นฐาน</GlassCardTitle></GlassCardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassInput label="รหัสเครื่องจักร" required error={errors.code?.message} {...register("code")} />
            <GlassInput label="ชื่อเครื่องจักร" required error={errors.name?.message} {...register("name")} />
            <GlassInput label="รุ่น (Model)" {...register("model")} />
            <GlassInput label="ผู้ผลิต" {...register("manufacturer")} />
            <GlassInput label="หมายเลขซีเรียล" {...register("serialNumber")} />
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">รายละเอียดเครื่องจักร</label>
              <textarea
                rows={4}
                placeholder="รายละเอียด ลักษณะการใช้งาน หรือข้อมูลเพิ่มเติม"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[80px]"
                {...register("description")}
              />
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader><GlassCardTitle>ขอบเขตการซ่อมบำรุง (Scope of Work)</GlassCardTitle></GlassCardHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                รอบ PM ทั่วไป
                <span className="ml-2 text-xs text-muted-foreground font-normal">General PM</span>
              </label>
              <textarea
                rows={6}
                placeholder={`รายการที่ต้องทำในรอบ PM ทั่วไป เช่น\n- ตรวจสอบสายไฟ ท่อไฟ ภายนอก\n- อัดจารบีลูกปืน\n- ตรวจสอบระดับน้ำมัน`}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[120px] font-mono"
                {...register("pmGeneral")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                รอบ PM ใหญ่
                <span className="ml-2 text-xs text-muted-foreground font-normal">Major PM</span>
              </label>
              <textarea
                rows={6}
                placeholder={`รายการที่ต้องทำในรอบ PM ใหญ่ เช่น\n- เปลี่ยนน้ำมันห้องเกียร์ (ปีละครั้ง)\n- ล้างทำความสะอาดถังน้ำมัน\n- สอบเทียบตามรอบกฎหมาย`}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[120px] font-mono"
                {...register("pmMajor")}
              />
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader><GlassCardTitle>วันที่</GlassCardTitle></GlassCardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassInput label="วันที่ติดตั้ง" type="date" {...register("installDate")} />
            <GlassInput label="วันหมดประกัน" type="date" {...register("warrantyExpireDate")} />
          </div>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader><GlassCardTitle>รูปภาพเครื่องจักร</GlassCardTitle></GlassCardHeader>
          <MultiImageUpload machineId={id} initialImages={images} />
        </GlassCard>

        <GlassCard>
          <GlassCardHeader><GlassCardTitle>รายการสินค้า / ผลิตภัณฑ์</GlassCardTitle></GlassCardHeader>
          <ProductsListEditor machineId={id} initialProducts={products} />
        </GlassCard>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3 justify-between">
          <GlassButton type="button" variant="danger" icon={<Trash2 className="w-4 h-4" />}
            onClick={async () => {
              const ok = await confirmType({ message: "ต้องการลบเครื่องจักรนี้?" })
              if (!ok) return
              await fetch(`/api/machines/${id}`, { method: "DELETE" })
              router.push("/machines")
              router.refresh()
            }}
          >
            ลบเครื่องจักร
          </GlassButton>
          <div className="flex gap-3">
            <Link href={`/machines/${id}`} className="px-5 py-2 border border-border text-muted-foreground text-sm font-medium rounded-lg hover:bg-muted/60 transition-colors">
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
