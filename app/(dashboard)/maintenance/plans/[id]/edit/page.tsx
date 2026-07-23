"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"

const schema = z.object({
  machineId: z.string().uuid(),
  typeId: z.string().uuid(),
  name: z.string().min(1, "กรุณากรอกชื่อแผน"),
  description: z.string().optional(),
  frequencyUnit: z.enum(["day", "week", "month", "quarter", "year", "runtime_hour"]),
  frequencyValue: z.coerce.number().int().min(1, "ความถี่ต้องมากกว่า 0"),
  estimatedDurationMin: z.coerce.number().int().min(1).optional(),
  startDate: z.string().min(1, "กรุณาเลือกวันเริ่มต้น"),
  endDate: z.string().optional(),
  leadTimeDays: z.coerce.number().int().min(0).default(7),
  isActive: z.boolean().default(true),
})

type FormData = z.infer<typeof schema>

const freqOptions = [
  { value: "day", label: "วัน" },
  { value: "week", label: "สัปดาห์" },
  { value: "month", label: "เดือน" },
  { value: "quarter", label: "ไตรมาส" },
  { value: "year", label: "ปี" },
  { value: "runtime_hour", label: "ชั่วโมงรัน" },
]

export default function EditMaintenancePlanPage() {
  const router = useRouter()
  const params = useParams()
  const planId = params.id as string
  const [machines, setMachines] = useState<{ id: string; name: string; code: string }[]>([])
  const [types, setTypes] = useState<{ id: string; name: string; code: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    Promise.all([
      fetch("/api/machines").then((r) => r.json()),
      fetch("/api/master-data/maintenance-types").then((r) => r.json()),
      fetch(`/api/maintenance-plans/${planId}`).then((r) => r.json()),
    ]).then(([m, t, p]) => {
      setMachines(m.data ?? [])
      setTypes(t.data ?? [])
      if (p.data) {
        const plan = p.data
        reset({
          machineId: plan.machineId,
          typeId: plan.typeId,
          name: plan.name,
          description: plan.description ?? "",
          frequencyUnit: plan.frequencyUnit,
          frequencyValue: plan.frequencyValue,
          estimatedDurationMin: plan.estimatedDurationMin ?? undefined,
          startDate: plan.startDate ? new Date(plan.startDate).toISOString().split("T")[0] : "",
          endDate: plan.endDate ? new Date(plan.endDate).toISOString().split("T")[0] : "",
          leadTimeDays: plan.leadTimeDays ?? 7,
          isActive: plan.isActive,
        })
      }
      setLoading(false)
    }).catch(() => {
      setError("ไม่สามารถโหลดข้อมูลได้")
      setLoading(false)
    })
  }, [planId, reset])

  const onSubmit = async (data: FormData) => {
    setError(null)
    const res = await fetch(`/api/maintenance-plans/${planId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      router.push(`/maintenance/plans/${planId}`)
      router.refresh()
    } else {
      const body = await res.json()
      setError(body.error?.message ?? "เกิดข้อผิดพลาด")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/maintenance/plans/${planId}`} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">แก้ไขแผนซ่อมบำรุง</h1>
          <p className="text-slate-500 text-sm mt-0.5">อัปเดตข้อมูลแผน PM/CM</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Card>
          <CardHeader><CardTitle>ข้อมูลพื้นฐาน</CardTitle></CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="เครื่องจักร"
              required
              error={errors.machineId?.message}
              {...register("machineId")}
            >
              <option value="">เลือกเครื่องจักร</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} - {m.name}
                </option>
              ))}
            </Select>
            <Select
              label="ประเภทการซ่อมบำรุง"
              required
              error={errors.typeId?.message}
              {...register("typeId")}
            >
              <option value="">เลือกประเภท</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} - {t.name}
                </option>
              ))}
            </Select>
            <div className="sm:col-span-2">
              <Input
                label="ชื่อแผน"
                required
                placeholder="เช่น PM รายเดือน - เครื่องกลึง A01"
                error={errors.name?.message}
                {...register("name")}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">ขอบเขตการทำงาน (Scope of Work) / รายละเอียด</label>
              <textarea
                rows={5}
                placeholder="ระบุรายการที่ต้องทำ เช่น&#10;- ตรวจสอบสายไฟ ท่อไฟ&#10;- อัดจารบีลูกปืน&#10;- เช็คความร้อนด้วย Temp Gun"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                {...register("description")}
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>ความถี่และระยะเวลา</CardTitle></CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="หน่วยความถี่"
              required
              error={errors.frequencyUnit?.message}
              {...register("frequencyUnit")}
            >
              {freqOptions.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
            <Input
              label="ค่าความถี่"
              type="number"
              min={1}
              required
              placeholder="เช่น 1, 3, 6"
              error={errors.frequencyValue?.message}
              {...register("frequencyValue")}
            />
            <Input
              label="ระยะเวลาโดยประมาณ (นาที)"
              type="number"
              min={1}
              placeholder="เช่น 60, 120"
              error={errors.estimatedDurationMin?.message}
              {...register("estimatedDurationMin")}
            />
            <Input
              label="วันเริ่มต้น"
              type="date"
              required
              error={errors.startDate?.message}
              {...register("startDate")}
            />
            <Input
              label="วันสิ้นสุด"
              type="date"
              error={errors.endDate?.message}
              {...register("endDate")}
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

        <Card>
          <CardHeader><CardTitle>สถานะ</CardTitle></CardHeader>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              {...register("isActive")}
            />
            <span className="text-sm text-slate-700">เปิดใช้งานแผนนี้</span>
          </label>
        </Card>

        <div className="flex justify-end gap-3">
          <Link
            href={`/maintenance/plans/${planId}`}
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
