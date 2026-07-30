"use client"

import { useState, useRef, useEffect } from "react"
import { X, Loader2, Image as ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { HomeScreenAssetKind, UploadProfile } from "@/lib/upload/image-profiles"

interface ImageUploadProps {
  value?: string
  onChange: (url: string) => void
  label?: string
  error?: string
  disabled?: boolean
  /** ความสูงพื้นที่แสดงตัวอย่าง เช่น h-32, h-48 — ไม่ใช้เมื่อเป็นไอคอนสี่เหลี่ยม */
  previewHeightClass?: string
  /**
   * โปรไฟล์การประมวลผลรูปฝั่งเซิร์ฟเวอร์ (ดู lib/upload/image-profiles.ts)
   * "homeScreenIcon" / "productLineIcon" — ครอปเป็นสี่เหลี่ยมจัตุรัส 512px WebP
   */
  uploadProfile?: UploadProfile
  /** จำเป็นเมื่อ uploadProfile เป็นไอคอนหน้าจอหลัก */
  assetKind?: HomeScreenAssetKind
  /** จำเป็นเมื่อ uploadProfile เป็นไอคอนหน้าจอหลัก — เช่น transport_ops, machines */
  assetId?: string
}

function isIconUploadProfile(profile: UploadProfile): boolean {
  return profile === "homeScreenIcon" || profile === "productLineIcon"
}

export function ImageUpload({
  value,
  onChange,
  label,
  error,
  disabled,
  previewHeightClass = "h-48",
  uploadProfile = "default",
  assetKind,
  assetId,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const isIconProfile = isIconUploadProfile(uploadProfile)

  useEffect(() => {
    setPreview(value)
  }, [value])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพเท่านั้น")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("ไฟล์มีขนาดใหญ่เกิน 5MB")
      return
    }

    if (isIconProfile && (!assetKind || !assetId)) {
      alert("ข้อมูลไอคอนไม่ครบ (assetKind / assetId)")
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    formData.append("profile", uploadProfile)
    if (isIconProfile && assetKind && assetId) {
      formData.append("assetKind", assetKind)
      formData.append("assetId", assetId)
    }

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.error?.message ?? errBody?.error ?? "Upload failed")
      }
      const data = await res.json()
      setPreview(data.data.fileUrl)
      onChange(data.data.fileUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "อัปโหลดไฟล์ไม่สำเร็จ"
      alert(msg)
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = () => {
    setPreview(undefined)
    onChange("")
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-foreground dark:text-muted-foreground">{label}</label>
      )}
      {isIconProfile && (
        <p className="text-xs text-muted-foreground dark:text-muted-foreground">
          แนะนำรูปสี่เหลี่ยมจัตุรัส เนื้อหาอยู่กลางภาพ — ระบบจะครอปและบีบอัดเป็น WebP ขนาด 512×512px โดยอัตโนมัติ
        </p>
      )}
      <div className="space-y-2">
        {preview ? (
          <div
            className={cn(
              "relative overflow-hidden rounded-xl border border-border bg-muted dark:border-slate-600 dark:bg-slate-900",
              isIconProfile ? "aspect-square w-28 sm:w-32" : `w-full ${previewHeightClass}`
            )}
          >
            {/* blob / local preview URL — next/image not suitable */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Preview"
              className={cn("h-full w-full", isIconProfile ? "object-cover" : "object-contain")}
            />
            {!disabled && (
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div
            onClick={() => !disabled && !uploading && inputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors",
              isIconProfile ? "aspect-square w-28 sm:w-32" : `w-full ${previewHeightClass}`,
              disabled
                ? "border-border bg-muted cursor-not-allowed dark:border-slate-700 dark:bg-slate-900"
                : uploading
                ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30"
                : "cursor-pointer border-border bg-muted hover:border-blue-400 hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-900/60 dark:hover:border-blue-500 dark:hover:bg-blue-950/30"
            )}
          >
            {uploading ? (
              <>
                <Loader2 className={cn("text-blue-500 animate-spin", isIconProfile ? "w-6 h-6" : "w-8 h-8")} />
                {!isIconProfile && <p className="text-sm text-blue-600">กำลังอัปโหลด...</p>}
              </>
            ) : (
              <>
                <div
                  className={cn(
                    "flex items-center justify-center rounded-full bg-card shadow-sm dark:bg-slate-800",
                    isIconProfile ? "h-8 w-8" : "h-10 w-10"
                  )}
                >
                  <ImageIcon className={cn("text-muted-foreground", isIconProfile ? "w-4 h-4" : "w-6 h-6")} />
                </div>
                <div className="text-center px-1">
                  <p className={cn("font-medium text-foreground", isIconProfile ? "text-xs" : "text-sm")}>
                    {isIconProfile ? "อัปโหลดไอคอน" : "คลิกเพื่ออัปโหลดรูปภาพ"}
                  </p>
                  {!isIconProfile && <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG, WEBP (สูงสุด 5MB)</p>}
                </div>
              </>
            )}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={disabled || uploading}
          className="hidden"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
