"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Save } from "lucide-react"
import { GlassButton, GlassCard, GlassCardHeader, GlassCardTitle, GlassInput } from "@/components/glass"
import {
  BranchLocationField,
  coordsFromLocationString,
} from "@/components/settings/branch-location-field"
import { parseLatLngInput } from "@/shared/transport/coordinates"
import Link from "next/link"

const schema = z.object({
  code: z.string().min(1, "กรุณากรอกรหัสสาขา").max(20),
  name: z.string().min(1, "กรุณากรอกชื่อสาขา").max(255),
  address: z.string().optional(),
  timezone: z.string().default("Asia/Bangkok"),
})

type FormData = z.infer<typeof schema>

export default function NewBranchPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [locationText, setLocationText] = useState("")
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { timezone: "Asia/Bangkok" },
  })

  const onSubmit = async (data: FormData) => {
    setError(null)
    if (locationText.trim() && !parseLatLngInput(locationText)) {
      setError("รูปแบบพิกัดไม่ถูกต้อง — ใช้ lat, lng")
      return
    }
    const geo = coordsFromLocationString(locationText)
    const res = await fetch("/api/settings/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, ...geo }),
    })
    if (!res.ok) {
      const json = await res.json()
      setError(json.error?.message ?? "เกิดข้อผิดพลาด")
      return
    }
    router.push("/settings/branches")
    router.refresh()
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/settings/branches" className="p-2 hover:bg-muted rounded-lg text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">เพิ่มสาขาใหม่</h1>
          <p className="text-muted-foreground text-sm mt-0.5">สร้างสาขาหรือโรงงานในเครือบริษัท</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <GlassCard>
          <GlassCardHeader><GlassCardTitle>ข้อมูลสาขา</GlassCardTitle></GlassCardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassInput
              label="รหัสสาขา"
              required
              placeholder="เช่น HQ, BKK01"
              error={errors.code?.message}
              {...register("code")}
            />
            <GlassInput
              label="ชื่อสาขา"
              required
              placeholder="เช่น สำนักงานใหญ่"
              error={errors.name?.message}
              {...register("name")}
            />
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">ที่อยู่</label>
              <textarea
                rows={3}
                placeholder="ที่อยู่สาขา..."
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                {...register("address")}
              />
            </div>
            <GlassInput
              label="Timezone"
              placeholder="Asia/Bangkok"
              {...register("timezone")}
            />
          </div>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle>ตำแหน่งสำหรับสภาพอากาศ</GlassCardTitle>
          </GlassCardHeader>
          <BranchLocationField value={locationText} onChange={setLocationText} />
        </GlassCard>

        <div className="flex justify-end gap-3">
          <Link
            href="/settings/branches"
            className="px-4 py-2 border border-border text-muted-foreground text-sm font-medium rounded-lg hover:bg-muted/60"
          >
            ยกเลิก
          </Link>
          <GlassButton type="submit" loading={isSubmitting}>
            <Save className="w-4 h-4" />
            บันทึกสาขา
          </GlassButton>
        </div>
      </form>
    </div>
  )
}
