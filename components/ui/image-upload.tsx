"use client"

import { useState, useRef, useEffect } from "react"
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react"
import Image from "next/image"

interface ImageUploadProps {
  value?: string
  onChange: (url: string) => void
  label?: string
  error?: string
  disabled?: boolean
  /** ความสูงพื้นที่แสดงตัวอย่าง เช่น h-32, h-48 */
  previewHeightClass?: string
}

export function ImageUpload({
  value,
  onChange,
  label,
  error,
  disabled,
  previewHeightClass = "h-48",
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(value)
  const [previewFailed, setPreviewFailed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
      <div className="space-y-2">
        {preview ? (
          <div className={`relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900 ${previewHeightClass}`}>
            {previewFailed ? (
              <img src={preview} alt="Preview" className="w-full h-full object-contain" />
            ) : (
              <Image
                src={preview}
                alt="Preview"
                fill
                className="object-contain"
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
            className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors ${previewHeightClass} ${
              disabled
                ? "border-slate-200 bg-slate-50 cursor-not-allowed dark:border-slate-700 dark:bg-slate-900"
                : uploading
                ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30"
                : "cursor-pointer border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-900/60 dark:hover:border-blue-500 dark:hover:bg-blue-950/30"
            }`}
          >
            {uploading ? (
              <>
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-sm text-blue-600">กำลังอัปโหลด...</p>
              </>
            ) : (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm dark:bg-slate-800">
                  <ImageIcon className="w-6 h-6 text-slate-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">คลิกเพื่ออัปโหลดรูปภาพ</p>
                  <p className="text-xs text-slate-400 mt-0.5">PNG, JPG, WEBP (สูงสุด 5MB)</p>
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
