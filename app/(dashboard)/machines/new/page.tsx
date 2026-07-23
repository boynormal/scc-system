"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Save, Check, ChevronRight } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { MultiImageUpload } from "@/components/ui/multi-image-upload"
import { ProductsListEditor } from "@/components/ui/products-list-editor"

const schema = z.object({
  branchId: z.string().uuid("กรุณาเลือกสาขา"),
  departmentId: z.string().optional(),
  categoryId: z.string().uuid("กรุณาเลือกหมวดหมู่"),
  code: z.string().min(1, "กรุณากรอกรหัส").max(50),
  name: z.string().min(1, "กรุณากรอกชื่อ").max(255),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  serialNumber: z.string().optional(),
  installDate: z.string().optional(),
  warrantyExpireDate: z.string().optional(),
  criticalLevel: z.coerce.number().int().min(1).max(4).default(1),
  locationDetail: z.string().optional(),
  machineType: z.string().optional(),
  description: z.string().optional(),
  pmGeneral: z.string().optional(),
  pmMajor: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function NewMachinePage() {
  const router = useRouter()
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [error, setError] = useState<string | null>(null)

  // Step 2 state — after machine is created
  const [createdMachineId, setCreatedMachineId] = useState<string | null>(null)
  const [createdMachineName, setCreatedMachineName] = useState("")

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const selectedBranchId = watch("branchId")

  useEffect(() => {
    fetch("/api/master-data/branches").then((r) => r.json()).then((d) => setBranches(d.data ?? []))
    fetch("/api/master-data/categories").then((r) => r.json()).then((d) => setCategories(d.data ?? []))
  }, [])

  useEffect(() => {
    if (selectedBranchId) {
      fetch(`/api/master-data/departments?branchId=${selectedBranchId}`)
        .then((r) => r.json())
        .then((d) => setDepartments(d.data ?? []))
    }
  }, [selectedBranchId])

  const onSubmit = async (data: FormData) => {
    setError(null)
    const res = await fetch("/api/machines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const json = await res.json()
      setCreatedMachineId(json.data.id)
      setCreatedMachineName(data.name)
    } else {
      const body = await res.json()
      setError(body.error?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่")
    }
  }

  // ─── Step 2: Images & Products ───────────────────────────────────────────────
  if (createdMachineId) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Check className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">สร้างเครื่องจักรสำเร็จ</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {createdMachineName} — เพิ่มรูปภาพและรายการสินค้าได้เลย (หรือข้ามได้)
            </p>
          </div>
        </div>

        {/* Stepper indicator */}
        <div className="flex items-center gap-2 text-sm">
          <span className="flex items-center gap-1.5 text-green-600 font-medium">
            <span className="w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs">✓</span>
            ข้อมูลพื้นฐาน
          </span>
          <ChevronRight className="w-4 h-4 text-slate-400" />
          <span className="flex items-center gap-1.5 text-blue-600 font-medium">
            <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
            รูปภาพและสินค้า
          </span>
        </div>

        <Card>
          <CardHeader><CardTitle>รูปภาพเครื่องจักร</CardTitle></CardHeader>
          <MultiImageUpload machineId={createdMachineId} initialImages={[]} />
        </Card>

        <Card>
          <CardHeader><CardTitle>รายการสินค้า / ผลิตภัณฑ์</CardTitle></CardHeader>
          <ProductsListEditor machineId={createdMachineId} initialProducts={[]} />
        </Card>

        <div className="flex gap-3 justify-end">
          <Link
            href={`/machines/${createdMachineId}/edit`}
            className="px-5 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            แก้ไขข้อมูลพื้นฐาน
          </Link>
          <Button
            type="button"
            icon={<Check className="w-4 h-4" />}
            onClick={() => router.push(`/machines/${createdMachineId}`)}
          >
            เสร็จสิ้น
          </Button>
        </div>
      </div>
    )
  }

  // ─── Step 1: Basic Info Form ──────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/machines"
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">เพิ่มเครื่องจักรใหม่</h1>
          <p className="text-slate-500 text-sm mt-0.5">กรอกข้อมูลพื้นฐาน จากนั้นเพิ่มรูปภาพและสินค้าในขั้นตอนถัดไป</p>
        </div>
      </div>

      {/* Stepper indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span className="flex items-center gap-1.5 text-blue-600 font-medium">
          <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
          ข้อมูลพื้นฐาน
        </span>
        <ChevronRight className="w-4 h-4 text-slate-400" />
        <span className="flex items-center gap-1.5 text-slate-400">
          <span className="w-5 h-5 bg-slate-200 text-slate-500 rounded-full flex items-center justify-center text-xs">2</span>
          รูปภาพและสินค้า
        </span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Location */}
        <Card>
          <CardHeader><CardTitle>ข้อมูลตำแหน่ง</CardTitle></CardHeader>
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
              label="แผนก"
              placeholder="เลือกแผนก (ถ้ามี)"
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
              {...register("departmentId")}
            />
            <Select
              label="หมวดหมู่เครื่องจักร"
              required
              placeholder="เลือกหมวดหมู่"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              error={errors.categoryId?.message}
              {...register("categoryId")}
            />
            <Input
              label="ตำแหน่งในโรงงาน"
              placeholder="เช่น อาคาร A ชั้น 1"
              {...register("locationDetail")}
            />
            <Input
              label="ประเภทเครื่องจักร"
              placeholder="เช่น CNC, Conveyor, Compressor"
              {...register("machineType")}
            />
          </div>
        </Card>

        {/* Basic Info */}
        <Card>
          <CardHeader><CardTitle>ข้อมูลพื้นฐาน</CardTitle></CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="รหัสเครื่องจักร"
              required
              placeholder="เช่น MCH-001"
              error={errors.code?.message}
              {...register("code")}
            />
            <Input
              label="ชื่อเครื่องจักร"
              required
              placeholder="เช่น Air Compressor Unit #1"
              error={errors.name?.message}
              {...register("name")}
            />
            <Input
              label="รุ่น (Model)"
              placeholder="เช่น AC-500"
              {...register("model")}
            />
            <Input
              label="ผู้ผลิต (Manufacturer)"
              placeholder="เช่น Atlas Copco"
              {...register("manufacturer")}
            />
            <Input
              label="หมายเลขซีเรียล"
              placeholder="Serial Number"
              {...register("serialNumber")}
            />
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">รายละเอียดเครื่องจักร</label>
              <textarea
                rows={4}
                placeholder="รายละเอียด ลักษณะการใช้งาน หรือข้อมูลเพิ่มเติม"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[80px]"
                {...register("description")}
              />
            </div>
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

        {/* PM Scope */}
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

        {/* Dates */}
        <Card>
          <CardHeader><CardTitle>วันที่</CardTitle></CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="วันที่ติดตั้ง"
              type="date"
              {...register("installDate")}
            />
            <Input
              label="วันหมดประกัน"
              type="date"
              {...register("warrantyExpireDate")}
            />
          </div>
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Link
            href="/machines"
            className="px-5 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            ยกเลิก
          </Link>
          <Button type="submit" loading={isSubmitting} icon={<Save className="w-4 h-4" />}>
            บันทึกและถัดไป
          </Button>
        </div>
      </form>
    </div>
  )
}
