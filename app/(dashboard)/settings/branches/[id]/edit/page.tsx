"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Save } from "lucide-react"
import { GlassButton, GlassCard, GlassCardHeader, GlassCardTitle, GlassInput } from "@/components/glass"
import {
  BranchLocationField,
  coordsFromLocationString,
} from "@/components/settings/branch-location-field"
import { decimalToNumber, formatLatLng, parseLatLngInput } from "@/shared/transport/coordinates"
import Link from "next/link"

const schema = z.object({
  code: z.string().min(1, "กรุณากรอกรหัสสาขา").max(20),
  name: z.string().min(1, "กรุณากรอกชื่อสาขา").max(255),
  address: z.string().optional(),
  timezone: z.string().min(1, "กรุณากรอก Timezone"),
  isActive: z.boolean(),
})

type FormData = z.infer<typeof schema>

export default function EditBranchPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)
  const [locationText, setLocationText] = useState("")

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    fetch(`/api/settings/branches/${id}`)
      .then((r) => r.json())
      .then(({ data, error: err }) => {
        if (err || !data) {
          setLoadError(typeof err === "string" ? err : "ไม่พบสาขา")
          return
        }
        reset({
          code: data.code,
          name: data.name,
          address: data.address ?? "",
          timezone: data.timezone,
          isActive: data.isActive,
        })
        setLocationText(
          formatLatLng(decimalToNumber(data.latitude), decimalToNumber(data.longitude))
        )
      })
      .catch(() => setLoadError("ไม่สามารถโหลดข้อมูลสาขาได้"))
      .finally(() => setFetching(false))
  }, [id, reset])

  const onSubmit = async (data: FormData) => {
    setError(null)
    if (locationText.trim() && !parseLatLngInput(locationText)) {
      setError("รูปแบบพิกัดไม่ถูกต้อง — ใช้ lat, lng")
      return
    }
    const geo = coordsFromLocationString(locationText)
    const res = await fetch(`/api/settings/branches/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, ...geo }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      setError(json?.error?.message ?? json?.error ?? "เกิดข้อผิดพลาด")
      return
    }
    router.push("/settings/branches")
    router.refresh()
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        กำลังโหลด...
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-4 max-w-xl">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{loadError}</div>
        <Link href="/settings/branches" className="text-sm text-blue-600 hover:underline">
          ← กลับไปหน้าสาขา
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/settings/branches" className="p-2 hover:bg-muted rounded-lg text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">แก้ไขสาขา</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            แก้ไขข้อมูลสาขา — สาขาที่ไม่ใช้แล้วให้ปิดใช้งานแทนการลบ
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle>ข้อมูลสาขา</GlassCardTitle>
          </GlassCardHeader>
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
              error={errors.timezone?.message}
              {...register("timezone")}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">สถานะ</label>
              <label className="flex items-center gap-3 cursor-pointer h-[38px]">
                <input type="checkbox" {...register("isActive")} className="w-4 h-4 rounded text-blue-600" />
                <span className="text-sm text-foreground">เปิดใช้งานสาขานี้</span>
              </label>
              <p className="text-xs text-muted-foreground">
                ปิดใช้งานแล้วสาขาจะไม่แสดงในรายการเลือก (ข้อมูลเก่ายังอยู่ครบ)
              </p>
            </div>
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
            <Save className="h-4 w-4" />
            บันทึกการแก้ไข
          </GlassButton>
        </div>
      </form>
    </div>
  )
}
