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
import { BeforeAfterImages } from "@/components/ui/before-after-images"

const schema = z.object({
  title: z.string().min(1, "กรุณากรอกหัวข้อ"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["draft", "open", "in_progress", "on_hold", "completed", "cancelled"]),
  assignedTo: z.string().optional(),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
  actualStart: z.string().optional(),
  actualEnd: z.string().optional(),
  rootCause: z.string().optional(),
  correctiveAction: z.string().optional(),
  remarks: z.string().optional(),
  downtimeMin: z.coerce.number().int().min(0).optional(),
})

type FormData = z.infer<typeof schema>

function toDatetimeLocal(d: string | Date | null | undefined): string {
  if (!d) return ""
  const date = d instanceof Date ? d : new Date(d)
  return date.toISOString().slice(0, 16)
}

const priorityOptions = [
  { value: "low", label: "ต่ำ" },
  { value: "medium", label: "ปานกลาง" },
  { value: "high", label: "สูง" },
  { value: "critical", label: "วิกฤต" },
]

const statusOptions = [
  { value: "draft", label: "ร่าง" },
  { value: "open", label: "เปิด" },
  { value: "in_progress", label: "กำลังดำเนินการ" },
  { value: "on_hold", label: "พัก" },
  { value: "completed", label: "เสร็จสิ้น" },
  { value: "cancelled", label: "ยกเลิก" },
]

export default function EditWorkOrderPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [woTitle, setWoTitle] = useState("")
  const [woNumber, setWoNumber] = useState("")
  const [users, setUsers] = useState<{ id: string; firstName: string; lastName: string }[]>([])
  const [imagesBefore, setImagesBefore] = useState<string[]>([])
  const [imagesAfter, setImagesAfter] = useState<string[]>([])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    Promise.all([
      fetch(`/api/work-orders/${id}`).then(r => r.json()),
      fetch("/api/users").then(r => r.json()),
    ]).then(([wo, u]) => {
      setUsers(u.data ?? [])
      if (wo.data) {
        const w = wo.data
        setWoTitle(w.title)
        setWoNumber(w.woNumber)
        setImagesBefore(Array.isArray(w.imagesBefore) ? w.imagesBefore : [])
        setImagesAfter(Array.isArray(w.imagesAfter) ? w.imagesAfter : [])
        reset({
          title: w.title,
          description: w.description ?? "",
          priority: w.priority,
          status: w.status,
          assignedTo: w.assignedTo ?? "",
          plannedStart: toDatetimeLocal(w.plannedStart),
          plannedEnd: toDatetimeLocal(w.plannedEnd),
          actualStart: toDatetimeLocal(w.actualStart),
          actualEnd: toDatetimeLocal(w.actualEnd),
          rootCause: w.rootCause ?? "",
          correctiveAction: w.correctiveAction ?? "",
          remarks: w.remarks ?? "",
          downtimeMin: w.downtimeMin ?? 0,
        })
      }
      setLoading(false)
    }).catch(() => { setError("ไม่สามารถโหลดข้อมูลได้"); setLoading(false) })
  }, [id, reset])

  const onSubmit = async (data: FormData) => {
    setError(null)
    const payload = {
      ...data,
      assignedTo: data.assignedTo || undefined,
      plannedStart: data.plannedStart || undefined,
      plannedEnd: data.plannedEnd || undefined,
      actualStart: data.actualStart || undefined,
      actualEnd: data.actualEnd || undefined,
      imagesBefore,
      imagesAfter,
    }
    const res = await fetch(`/api/work-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      router.push(`/work-orders/${id}`)
      router.refresh()
    } else {
      const json = await res.json()
      setError(json.error?.message ?? "เกิดข้อผิดพลาด")
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
        <Link href={`/work-orders/${id}`} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">แก้ไขใบสั่งงาน</h1>
          <p className="text-slate-500 text-sm mt-0.5">{woNumber} · {woTitle}</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Card>
          <CardHeader><CardTitle>ข้อมูลหลัก</CardTitle></CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="สถานะ" required options={statusOptions} {...register("status")} />
            <Select label="ความสำคัญ" required options={priorityOptions} {...register("priority")} />
            <div className="sm:col-span-2">
              <Input label="หัวข้อ" required error={errors.title?.message} {...register("title")} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">รายละเอียด</label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                {...register("description")}
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle>การมอบหมายและเวลา</CardTitle></CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="ผู้รับผิดชอบ"
              placeholder="เลือกผู้รับผิดชอบ"
              options={users.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))}
              {...register("assignedTo")}
            />
            <Input label="Downtime (นาที)" type="number" min={0} {...register("downtimeMin")} />
            <Input label="วันเวลาเริ่มต้น (แผน)" type="datetime-local" {...register("plannedStart")} />
            <Input label="วันเวลาสิ้นสุด (แผน)" type="datetime-local" {...register("plannedEnd")} />
            <Input label="วันเวลาเริ่มจริง" type="datetime-local" {...register("actualStart")} />
            <Input label="วันเวลาสิ้นสุดจริง" type="datetime-local" {...register("actualEnd")} />
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

        <Card>
          <CardHeader><CardTitle>สรุปผลการซ่อม</CardTitle></CardHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">สาเหตุของปัญหา (Root Cause)</label>
              <textarea rows={2} placeholder="อธิบายสาเหตุที่พบ..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                {...register("rootCause")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">การแก้ไข (Corrective Action)</label>
              <textarea rows={3} placeholder="อธิบายสิ่งที่ดำเนินการเพื่อแก้ไขปัญหา..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                {...register("correctiveAction")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">หมายเหตุ</label>
              <textarea rows={2} placeholder="หมายเหตุเพิ่มเติม..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                {...register("remarks")} />
            </div>
          </div>
        </Card>

        <div className="flex gap-3 justify-between">
          <Button
            type="button"
            variant="danger"
            icon={<Trash2 className="w-4 h-4" />}
            onClick={async () => {
              if (!confirm("ต้องการลบใบสั่งงานนี้?")) return
              await fetch(`/api/work-orders/${id}`, { method: "DELETE" })
              router.push("/work-orders")
              router.refresh()
            }}
          >
            ลบใบสั่งงาน
          </Button>
          <div className="flex gap-3">
            <Link
              href={`/work-orders/${id}`}
              className="px-4 py-2 border border-slate-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50"
            >
              ยกเลิก
            </Link>
            <Button type="submit" loading={isSubmitting} icon={<Save className="w-4 h-4" />}>
              บันทึก
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
