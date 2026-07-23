"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
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

function NewMaintenancePlanForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const machineId = searchParams.get("machineId")
  const [machines, setMachines] = useState<{ id: string; name: string; code: string }[]>([])
  const [types, setTypes] = useState<{ id: string; name: string; code: string }[]>([])
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { machineId: machineId ?? "", leadTimeDays: 7 },
  })

  useEffect(() => {
    Promise.all([
      fetch("/api/machines").then((r) => r.json()),
      fetch("/api/master-data/maintenance-types").then((r) => r.json()),
    ]).then(([m, t]) => {
      setMachines(m.data ?? [])
      setTypes(t.data ?? [])
    })
  }, [])

  const onSubmit = async (data: FormData) => {
    setError(null)
    const res = await fetch("/api/maintenance-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      router.push("/maintenance/plans")
      router.refresh()
    } else {
      const body = await res.json()
      setError(body.error?.message ?? "เกิดข้อผิดพลาด")
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/maintenance/plans" className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">สร้างแผนซ่อมบำรุง</h1>
          <p className="text-slate-500 text-sm mt-0.5">กำหนด PM/CM พร้อมความถี่และ checklist</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Card>
          <CardHeader><CardTitle>ข้อมูลพื้นฐาน</CardTitle></CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="เครื่องจักร"
              required
              placeholder="เลือกเครื่องจักร"
              options={machines.map((m) => ({ value: m.id, label: `${m.name} (${m.code})` }))}
              error={errors.machineId?.message}
              {...register("machineId")}
            />
            <Select
              label="ประเภทการซ่อมบำรุง"
              required
              placeholder="เลือกประเภท"
              options={types.map((t) => ({ value: t.id, label: `${t.name} (${t.code})` }))}
              error={errors.typeId?.message}
              {...register("typeId")}
            />
            <Input label="ชื่อแผน" required error={errors.name?.message} {...register("name")} />
            <Input label="ระยะเวลาโดยประมาณ (นาที)" type="number" {...register("estimatedDurationMin")} />
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">ขอบเขตการทำงาน (Scope of Work) / รายละเอียด</label>
            <textarea
              rows={5}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              placeholder="ระบุรายการที่ต้องทำ เช่น&#10;- ตรวจสอบสายไฟ ท่อไฟ&#10;- อัดจารบีลูกปืน&#10;- เช็คความร้อนด้วย Temp Gun"
              {...register("description")}
            />
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>ความถี่และวันที่</CardTitle></CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="ความถี่"
              required
              options={freqOptions}
              error={errors.frequencyUnit?.message}
              {...register("frequencyUnit")}
            />
            <Input
              label="ค่าความถี่"
              required
              type="number"
              min={1}
              placeholder="เช่น 3"
              error={errors.frequencyValue?.message}
              {...register("frequencyValue")}
            />
            <Input
              label="วันที่เริ่มต้น"
              required
              type="date"
              error={errors.startDate?.message}
              {...register("startDate")}
            />
            <Input label="วันที่สิ้นสุด (ถ้ามี)" type="date" {...register("endDate")} />
            <Input
              label="จำนวนวันแจ้งเตือนล่วงหน้า"
              type="number"
              min={0}
              hint="จำนวนวันก่อนถึงกำหนดที่จะแจ้งเตือน"
              {...register("leadTimeDays")}
            />
          </div>
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Link href="/maintenance/plans" className="px-5 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            ยกเลิก
          </Link>
          <Button type="submit" loading={isSubmitting} icon={<Save className="w-4 h-4" />}>
            สร้างแผนซ่อมบำรุง
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function NewMaintenancePlanPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <NewMaintenancePlanForm />
    </Suspense>
  )
}
