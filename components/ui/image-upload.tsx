"use client"

import { useState, useRef, useEffect } from "react"
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface ImageUploadProps {
  value?: string
  onChange: (url: string) => void
  label?: string
  error?: string
  disabled?: boolean
  /** ความสูงพื้นที่แสดงตัวอย่าง เช่น h-32, h-48 — ไม่ใช้เมื่อ uploadProfile="productLineIcon" (ใช้กรอบสี่เหลี่ยมจัตุรัสแทน) */
  previewHeightClass?: string
  /**
   * โปรไฟล์การประมวลผลรูปฝั่งเซิร์ฟเวอร์ (ดู lib/upload/image-profiles.ts)
   * "productLineIcon" — เซิร์ฟเวอร์จะครอปเป็นสี่เหลี่ยมจัตุรัส 512px แล้วบีบอัดเป็น WebP
   * ให้ preview เป็นสี่เหลี่ยมจัตุรัสแบบ object-cover ตรงกับที่แสดงจริงบน sidebar/launcher
   */
  uploadProfile?: "default" | "productLineIcon"
}

export function ImageUpload({
  value,
  onChange,
  label,
  error,
  disabled,
  previewHeightClass = "h-48",
  uploadProfile = "default",
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(value)
  const [previewFailed, setPreviewFailed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const isIconProfile = uploadProfile === "productLineIcon"

  useEffect(() => {
    setPreview(value)
    setPreviewFailed(false)
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

    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    formData.append("profile", uploadProfile)

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) throw new Error("Upload failed")
      const data = await res.json()
      setPreview(data.data.fileUrl)
      setPreviewFailed(false)
      onChange(data.data.fileUrl)
    } catch (err) {
      alert("อัปโหลดไฟล์ไม่สำเร็จ")
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
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      )}
      {isIconProfile && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          แนะนำรูปสี่เหลี่ยมจัตุรัส เนื้อหาอยู่กลางภาพ — ระบบจะครอปและบีบอัดเป็น WebP ขนาด 512×512px โดยอัตโนมัติ
        </p>
      )}
      <div className="space-y-2">
        {preview ? (
          <div
            className={cn(
              "relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900",
              isIconProfile ? "aspect-square w-28 sm:w-32" : `w-full ${previewHeightClass}`
            )}
          >
            {previewFailed ? (
              <img
                src={preview}
                alt="Preview"
                className={cn("w-full h-full", isIconProfile ? "object-cover" : "object-contain")}
              />
            ) : (
              <Image
                src={preview}
                alt="Preview"
                fill
                className={isIconProfile ? "object-cover" : "object-contain"}
                unoptimized
                onError={() => setPreviewFailed(true)}
              />
            )}
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
                ? "border-slate-200 bg-slate-50 cursor-not-allowed dark:border-slate-700 dark:bg-slate-900"
                : uploading
                ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30"
                : "cursor-pointer border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-900/60 dark:hover:border-blue-500 dark:hover:bg-blue-950/30"
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
                    "flex items-center justify-center rounded-full bg-white shadow-sm dark:bg-slate-800",
                    isIconProfile ? "h-8 w-8" : "h-10 w-10"
                  )}
                >
                  <ImageIcon className={cn("text-slate-400", isIconProfile ? "w-4 h-4" : "w-6 h-6")} />
                </div>
                <div className="text-center px-1">
                  <p className={cn("font-medium text-slate-700 dark:text-slate-200", isIconProfile ? "text-xs" : "text-sm")}>
                    {isIconProfile ? "อัปโหลดไอคอน" : "คลิกเพื่ออัปโหลดรูปภาพ"}
                  </p>
                  {!isIconProfile && <p className="text-xs text-slate-400 mt-0.5">PNG, JPG, WEBP (สูงสุด 5MB)</p>}
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
