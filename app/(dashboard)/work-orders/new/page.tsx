"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { BeforeAfterImages } from "@/components/ui/before-after-images"

const schema = z.object({
  machineId: z.string().uuid("กรุณาเลือกเครื่องจักร"),
  typeId: z.string().uuid("กรุณาเลือกประเภท"),
  branchId: z.string().uuid("กรุณาเลือกสาขา"),
  title: z.string().min(1, "กรุณากรอกหัวข้อ"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  assignedTo: z.string().optional(),
  scheduleId: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const priorityOptions = [
  { value: "low", label: "ต่ำ" },
  { value: "medium", label: "ปานกลาง" },
  { value: "high", label: "สูง" },
  { value: "critical", label: "วิกฤต" },
]

function NewWorkOrderForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const machineId = searchParams.get("machineId")
  const scheduleId = searchParams.get("scheduleId")
  const [machines, setMachines] = useState<{ id: string; name: string; code: string; branchId: string }[]>([])
  const [users, setUsers] = useState<{ id: string; firstName: string; lastName: string }[]>([])
  const [types, setTypes] = useState<{ id: string; name: string; code: string }[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [schedules, setSchedules] = useState<{ id: string; dueDate: string; machine: { name: string } }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [imagesBefore, setImagesBefore] = useState<string[]>([])
  const [imagesAfter, setImagesAfter] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { machineId: machineId ?? "", scheduleId: scheduleId ?? "", priority: "medium" },
  })

  const selectedMachineId = watch("machineId")

  useEffect(() => {
    Promise.all([
      fetch("/api/machines").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/master-data/maintenance-types").then((r) => r.json()),
      fetch("/api/master-data/branches").then((r) => r.json()),
    ]).then(([m, u, t, b]) => {
      setMachines(m.data ?? [])
      setUsers(u.data ?? [])
      setTypes(t.data ?? [])
      setBranches(b.data ?? [])
    })
  }, [])

  useEffect(() => {
    if (selectedMachineId) {
      fetch(`/api/schedules?machineId=${selectedMachineId}&status=pending`)
        .then((r) => r.json())
        .then((d) => setSchedules(d.data ?? []))
      // Auto-fill branchId from machine
      const machine = machines.find((m) => m.id === selectedMachineId)
      if (machine) setValue("branchId", machine.branchId)
    }
  }, [selectedMachineId, machines, setValue])

  useEffect(() => {
    if (scheduleId) setValue("scheduleId", scheduleId)
  }, [scheduleId, setValue])

  const onSubmit = async (data: FormData) => {
    setError(null)
    const payload = {
      ...data,
      assignedTo: data.assignedTo || undefined,
      scheduleId: data.scheduleId || undefined,
      imagesBefore,
      imagesAfter,
    }
    const res = await fetch("/api/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const json = await res.json()
      router.push(`/work-orders/${json.data.id}`)
      router.refresh()
    } else {
      const body = await res.json()
      setError(body.error?.message ?? "เกิดข้อผิดพลาด")
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/work-orders" className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">สร้างใบสั่งงาน</h1>
          <p className="text-slate-500 text-sm mt-0.5">สร้างใบสั่งงานซ่อมบำรุงใหม่</p>
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
              label="สาขา"
              required
              placeholder="เลือกสาขา"
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
              error={errors.branchId?.message}
              {...register("branchId")}
            />
            <Select
              label="ประเภทการซ่อมบำรุง"
              required
              placeholder="เลือกประเภท"
              options={types.map((t) => ({ value: t.id, label: `${t.code} - ${t.name}` }))}
              error={errors.typeId?.message}
              {...register("typeId")}
            />
            <Select
              label="ความสำคัญ"
              required
              options={priorityOptions}
              error={errors.priority?.message}
              {...register("priority")}
            />
            <div className="sm:col-span-2">
              <Input label="หัวข้อ" required error={errors.title?.message} {...register("title")} />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">รายละเอียด</label>
            <textarea
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="รายละเอียดเกี่ยวกับปัญหาและสิ่งที่ต้องทำ"
              {...register("description")}
            />
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>มอบหมายและเชื่อมโยง</CardTitle></CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="ผู้รับผิดชอบ"
              placeholder="เลือกผู้รับผิดชอบ"
              options={users.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))}
              {...register("assignedTo")}
            />
            <Select
              label="เชื่อมโยงกับกำหนดการ (ถ้ามี)"
              placeholder="เลือกกำหนดการ"
              options={schedules.map((s) => ({
                value: s.id,
                label: `${s.machine.name} — ${new Date(s.dueDate).toLocaleDateString("th-TH")}`,
              }))}
              {...register("scheduleId")}
            />
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>รูปภาพก่อน/หลังซ่อม</CardTitle></CardHeader>
          <BeforeAfterImages
            beforeImages={imagesBefore}
            afterImages={imagesAfter}
            onBeforeChange={setImagesBefore}
            onAfterChange={setImagesAfter}
          />
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Link href="/work-orders" className="px-5 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
            ยกเลิก
          </Link>
          <Button type="submit" loading={isSubmitting} icon={<Save className="w-4 h-4" />}>
            สร้างใบสั่งงาน
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function NewWorkOrderPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <NewWorkOrderForm />
    </Suspense>
  )
}
