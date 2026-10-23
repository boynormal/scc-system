"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { Select } from "@/components/ui/select"
import { BeforeAfterImages } from "@/components/ui/before-after-images"
import { GlassButton, GlassCard, GlassCardHeader, GlassCardTitle, GlassInput } from "@/components/glass"
import { pmAssetHint, pmAssetLabel, type PmAssetOption } from "@/components/maintenance/pm-asset-option"

const schema = z
  .object({
    kind: z.enum(["asset", "general"]),
    assetId: z.string().optional(),
    branchId: z.string().optional(),
    typeId: z.string().uuid("กรุณาเลือกประเภท"),
    title: z.string().min(1, "กรุณากรอกหัวข้อ"),
    description: z.string().optional(),
    priority: z.enum(["low", "medium", "high", "critical"]),
    assignedTo: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "asset" && !v.assetId) {
      ctx.addIssue({ code: "custom", path: ["assetId"], message: "กรุณาเลือกทรัพย์สิน" })
    }
    if (v.kind === "general" && !v.branchId) {
      ctx.addIssue({ code: "custom", path: ["branchId"], message: "กรุณาเลือกสาขา" })
    }
  })

const kindOptions = [
  { value: "asset", label: "ทรัพย์สินในทะเบียน" },
  { value: "general", label: "งานทั่วไป (ไม่ผูกทรัพย์สิน เช่น ไฟ ประปา เก้าอี้)" },
]

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
  const machineIdParam = searchParams.get("machineId")
  const assetIdParam = searchParams.get("assetId")
  const [assets, setAssets] = useState<PmAssetOption[] | null>(null)
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [users, setUsers] = useState<{ id: string; firstName: string; lastName: string }[]>([])
  const [types, setTypes] = useState<{ id: string; name: string; code: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ id: string; warning: string } | null>(null)
  const [preset, setPreset] = useState<string | null>(null)
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
    defaultValues: { kind: "asset", assetId: "", branchId: "", priority: "medium" },
  })

  const kind = watch("kind")
  const selectedAsset = assets?.find((a) => a.id === watch("assetId")) ?? null
  const assetHint =
    assets && assets.length === 0
      ? "ยังไม่มีทรัพย์สินที่ใช้งานอยู่ในทะเบียน เลือกงานทั่วไปได้"
      : selectedAsset
        ? `สาขาของใบงานตามทรัพย์สิน: ${pmAssetHint(assets, selectedAsset)}`
        : undefined

  useEffect(() => {
    Promise.all([
      fetch("/api/maintenance/pm-assets?for=work_order").then((r) => r.json()),
      fetch("/api/master-data/branches").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/master-data/maintenance-types").then((r) => r.json()),
    ]).then(([a, b, u, t]) => {
      const assetOptions: PmAssetOption[] = a.data ?? []
      setAssets(assetOptions)
      setBranches(b.data ?? [])
      setUsers(u.data ?? [])
      setTypes(t.data ?? [])
      const byMachine = machineIdParam ? assetOptions.find((o) => o.machineId === machineIdParam) : undefined
      if (assetIdParam && assetOptions.some((o) => o.id === assetIdParam)) setPreset(assetIdParam)
      else if (byMachine) setPreset(byMachine.id)
      else if (machineIdParam) setValue("kind", "general")
    })
  }, [assetIdParam, machineIdParam, setValue])

  // The <option> must be rendered before setValue can select it.
  useEffect(() => {
    if (preset) setValue("assetId", preset)
  }, [preset, setValue])

  const onSubmit = async ({ kind: picked, assetId, branchId, ...data }: FormData) => {
    setError(null)
    const payload = {
      ...data,
      ...(picked === "asset" ? { assetId } : { branchId }),
      assignedTo: data.assignedTo || undefined,
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
      if (json.warning) {
        setCreated({ id: json.data.id, warning: json.warning })
        return
      }
      router.push(`/work-orders/${json.data.id}`)
      router.refresh()
    } else {
      const body = await res.json()
      setError(typeof body.error === "string" ? body.error : body.error?.message ?? "เกิดข้อผิดพลาด")
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/work-orders" className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">สร้างใบสั่งงาน</h1>
          <p className="text-muted-foreground text-sm mt-0.5">สร้างใบสั่งงานซ่อมบำรุงใหม่</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <GlassCard>
          <GlassCardHeader><GlassCardTitle>ข้อมูลพื้นฐาน</GlassCardTitle></GlassCardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Select label="แจ้งซ่อมสำหรับ" required options={kindOptions} {...register("kind")} />
            </div>
            <div className="sm:col-span-2">
              {kind === "asset" ? (
                <Select
                  label="ทรัพย์สิน"
                  required
                  placeholder="เลือกทรัพย์สิน"
                  options={(assets ?? []).map((a) => ({ value: a.id, label: pmAssetLabel(a) }))}
                  error={errors.assetId?.message}
                  hint={assetHint}
                  {...register("assetId")}
                />
              ) : (
                <Select
                  label="สาขา"
                  required
                  placeholder="เลือกสาขา"
                  options={branches.map((b) => ({ value: b.id, label: b.name }))}
                  error={errors.branchId?.message}
                  hint="งานทั่วไปไม่ผูกทรัพย์สิน ระบุสิ่งที่ซ่อมในหัวข้อและรายละเอียด"
                  {...register("branchId")}
                />
              )}
            </div>
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
              <GlassInput label="หัวข้อ" required error={errors.title?.message} {...register("title")} />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-foreground mb-1">รายละเอียด</label>
            <textarea
              rows={4}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="รายละเอียดเกี่ยวกับปัญหาและสิ่งที่ต้องทำ"
              {...register("description")}
            />
          </div>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader><GlassCardTitle>มอบหมาย</GlassCardTitle></GlassCardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="ผู้รับผิดชอบ"
              placeholder="เลือกผู้รับผิดชอบ"
              options={users.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))}
              {...register("assignedTo")}
            />
          </div>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader><GlassCardTitle>รูปภาพก่อน/หลังซ่อม</GlassCardTitle></GlassCardHeader>
          <BeforeAfterImages
            beforeImages={imagesBefore}
            afterImages={imagesAfter}
            onBeforeChange={setImagesBefore}
            onAfterChange={setImagesAfter}
          />
        </GlassCard>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {created && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/50 dark:bg-amber-950/40">
            <p className="text-sm text-amber-800 dark:text-amber-200">สร้างใบสั่งงานแล้ว · {created.warning}</p>
            <Link href={`/work-orders/${created.id}`} className="text-sm font-medium text-amber-900 underline dark:text-amber-100">
              ไปที่ใบสั่งงาน
            </Link>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Link href="/work-orders" className="px-5 py-2 border border-border text-muted-foreground text-sm font-medium rounded-lg hover:bg-muted/60 transition-colors">
            ยกเลิก
          </Link>
          <GlassButton type="submit" loading={isSubmitting} disabled={!!created} icon={<Save className="w-4 h-4" />}>
            สร้างใบสั่งงาน
          </GlassButton>
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
