"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Save, Trash2 } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { MultiImageUpload } from "@/components/ui/multi-image-upload"
import { ProductsListEditor } from "@/components/ui/products-list-editor"

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
        <Link href={`/machines/${id}`} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">แก้ไขเครื่องจักร</h1>
          <p className="text-slate-500 text-sm mt-0.5">{machineName}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Card>
          <CardHeader><CardTitle>สถานะและตำแหน่ง</CardTitle></CardHeader>
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
            <Input label="ตำแหน่งในโรงงาน" placeholder="เช่น อาคาร A ชั้น 1" {...register("locationDetail")} />
            <Input label="ประเภทเครื่องจักร" placeholder="เช่น CNC, Conveyor, Compressor" {...register("machineType")} />
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
        </Card>

        <Card>
          <CardHeader><CardTitle>ข้อมูลพื้นฐาน</CardTitle></CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="รหัสเครื่องจักร" required error={errors.code?.message} {...register("code")} />
            <Input label="ชื่อเครื่องจักร" required error={errors.name?.message} {...register("name")} />
            <Input label="รุ่น (Model)" {...register("model")} />
            <Input label="ผู้ผลิต" {...register("manufacturer")} />
            <Input label="หมายเลขซีเรียล" {...register("serialNumber")} />
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">รายละเอียดเครื่องจักร</label>
              <textarea
                rows={4}
                placeholder="รายละเอียด ลักษณะการใช้งาน หรือข้อมูลเพิ่มเติม"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[80px]"
                {...register("description")}
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>ขอบเขตการซ่อมบำรุง (Scope of Work)</CardTitle></CardHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                รอบ PM ทั่วไป
                <span className="ml-2 text-xs text-slate-400 font-normal">General PM</span>
              </label>
              <textarea
                rows={6}
                placeholder={`รายการที่ต้องทำในรอบ PM ทั่วไป เช่น\n- ตรวจสอบสายไฟ ท่อไฟ ภายนอก\n- อัดจารบีลูกปืน\n- ตรวจสอบระดับน้ำมัน`}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[120px] font-mono"
                {...register("pmGeneral")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                รอบ PM ใหญ่
                <span className="ml-2 text-xs text-slate-400 font-normal">Major PM</span>
              </label>
              <textarea
                rows={6}
                placeholder={`รายการที่ต้องทำในรอบ PM ใหญ่ เช่น\n- เปลี่ยนน้ำมันห้องเกียร์ (ปีละครั้ง)\n- ล้างทำความสะอาดถังน้ำมัน\n- สอบเทียบตามรอบกฎหมาย`}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[120px] font-mono"
                {...register("pmMajor")}
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>วันที่</CardTitle></CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="วันที่ติดตั้ง" type="date" {...register("installDate")} />
            <Input label="วันหมดประกัน" type="date" {...register("warrantyExpireDate")} />
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>รูปภาพเครื่องจักร</CardTitle></CardHeader>
          <MultiImageUpload machineId={id} initialImages={images} />
        </Card>

        <Card>
          <CardHeader><CardTitle>รายการสินค้า / ผลิตภัณฑ์</CardTitle></CardHeader>
          <ProductsListEditor machineId={id} initialProducts={products} />
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3 justify-between">
          <Button type="button" variant="danger" icon={<Trash2 className="w-4 h-4" />}
            onClick={async () => {
              if (!confirm("ต้องการลบเครื่องจักรนี้?")) return
              await fetch(`/api/machines/${id}`, { method: "DELETE" })
              router.push("/machines")
              router.refresh()
            }}
          >
            ลบเครื่องจักร
          </Button>
          <div className="flex gap-3">
            <Link href={`/machines/${id}`} className="px-5 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
              ยกเลิก
            </Link>
            <Button type="submit" loading={isSubmitting} icon={<Save className="w-4 h-4" />}>
              บันทึกการแก้ไข
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
