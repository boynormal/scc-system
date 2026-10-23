"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { Select } from "@/components/ui/select"
import { GlassButton, GlassCard, GlassCardHeader, GlassCardTitle, GlassInput } from "@/components/glass"
import { ChecklistTemplatePicker } from "../checklist-template-picker"
import { pmAssetHint, pmAssetLabel, type PmAssetOption } from "@/components/maintenance/pm-asset-option"

const schema = z.object({
  assetId: z.string().uuid("กรุณาเลือกทรัพย์สิน"),
  typeId: z.string().uuid(),
  name: z.string().min(1, "กรุณากรอกชื่อแผน"),
  description: z.string().optional(),
  frequencyUnit: z.enum(["day", "week", "month", "quarter", "year"]),
  frequencyValue: z.coerce.number().int().min(1, "ความถี่ต้องมากกว่า 0"),
  estimatedDurationMin: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.number().int().min(1, "ต้องมากกว่า 0").optional()
  ),
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
]

function NewMaintenancePlanForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const assetIdParam = searchParams.get("assetId")
  const machineIdParam = searchParams.get("machineId")
  const [assets, setAssets] = useState<PmAssetOption[] | null>(null)
  const [types, setTypes] = useState<{ id: string; name: string; code: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [templateIds, setTemplateIds] = useState<string[]>([])
  const [presetId, setPresetId] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { assetId: "", leadTimeDays: 7 },
  })
  const selectedAsset = assets?.find((a) => a.id === watch("assetId")) ?? null

  useEffect(() => {
    Promise.all([
      fetch("/api/maintenance/pm-assets?for=plan").then((r) => r.json()),
      fetch("/api/master-data/maintenance-types").then((r) => r.json()),
    ]).then(([a, t]) => {
      const options: PmAssetOption[] = a.data ?? []
      setAssets(options)
      setTypes(t.data ?? [])
      const preset =
        options.find((o) => o.id === assetIdParam) ??
        (machineIdParam ? options.find((o) => o.link?.kind === "machine" && o.link.id === machineIdParam) : undefined)
      if (preset) setPresetId(preset.id)
    })
  }, [assetIdParam, machineIdParam])

  // The <option> must be rendered before setValue can select it.
  useEffect(() => {
    if (presetId) setValue("assetId", presetId)
  }, [presetId, setValue])

  const onSubmit = async (data: FormData) => {
    setError(null)
    const res = await fetch("/api/maintenance-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, templateIds }),
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
        <Link href="/maintenance/plans" className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">สร้างแผนซ่อมบำรุง</h1>
          <p className="text-muted-foreground text-sm mt-0.5">กำหนด PM/CM พร้อมความถี่และ checklist</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <GlassCard>
          <GlassCardHeader><GlassCardTitle>ข้อมูลพื้นฐาน</GlassCardTitle></GlassCardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="ทรัพย์สิน"
              required
              placeholder="เลือกทรัพย์สิน"
              options={(assets ?? []).map((a) => ({ value: a.id, label: pmAssetLabel(a) }))}
              error={errors.assetId?.message}
              hint={pmAssetHint(assets, selectedAsset)}
              {...register("assetId")}
            />
            <Select
              label="ประเภทการซ่อมบำรุง"
              required
              placeholder="เลือกประเภท"
              options={types.map((t) => ({ value: t.id, label: `${t.name} (${t.code})` }))}
              error={errors.typeId?.message}
              {...register("typeId")}
            />
            <GlassInput label="ชื่อแผน" required error={errors.name?.message} {...register("name")} />
            <GlassInput
              label="ระยะเวลาโดยประมาณ (นาที)"
              type="number"
              error={errors.estimatedDurationMin?.message}
              {...register("estimatedDurationMin")}
            />
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-foreground mb-1">ขอบเขตการทำงาน (Scope of Work) / รายละเอียด</label>
            <textarea
              rows={5}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              placeholder="ระบุรายการที่ต้องทำ เช่น&#10;- ตรวจสอบสายไฟ ท่อไฟ&#10;- อัดจารบีลูกปืน&#10;- เช็คความร้อนด้วย Temp Gun"
              {...register("description")}
            />
          </div>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader><GlassCardTitle>ความถี่และวันที่</GlassCardTitle></GlassCardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="ความถี่"
              required
              options={freqOptions}
              error={errors.frequencyUnit?.message}
              {...register("frequencyUnit")}
            />
            <GlassInput
              label="ค่าความถี่"
              required
              type="number"
              min={1}
              placeholder="เช่น 3"
              error={errors.frequencyValue?.message}
              {...register("frequencyValue")}
            />
            <GlassInput
              label="วันที่เริ่มต้น"
              required
              type="date"
              error={errors.startDate?.message}
              {...register("startDate")}
            />
            <GlassInput label="วันที่สิ้นสุด (ถ้ามี)" type="date" {...register("endDate")} />
            <GlassInput
              label="จำนวนวันแจ้งเตือนล่วงหน้า"
              type="number"
              min={0}
              hint="จำนวนวันก่อนถึงกำหนดที่ระบบจะสร้างรอบและใบ PM"
              {...register("leadTimeDays")}
            />
          </div>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader><GlassCardTitle>รายการตรวจ (Checklist)</GlassCardTitle></GlassCardHeader>
          <ChecklistTemplatePicker value={templateIds} onChange={setTemplateIds} />
        </GlassCard>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Link href="/maintenance/plans" className="px-5 py-2 border border-border text-muted-foreground text-sm font-medium rounded-lg hover:bg-muted/60 transition-colors">
            ยกเลิก
          </Link>
          <GlassButton type="submit" loading={isSubmitting} icon={<Save className="w-4 h-4" />}>
            สร้างแผนซ่อมบำรุง
          </GlassButton>
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
