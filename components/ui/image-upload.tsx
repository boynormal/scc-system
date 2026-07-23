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
        <label className="block text-sm font-medium text-slate-700">{label}</label>
      )}
      <div className="space-y-2">
        {preview ? (
          <div className={`relative w-full rounded-lg border border-slate-200 overflow-hidden bg-slate-50 ${previewHeightClass}`}>
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
            className={`w-full border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 transition-colors ${previewHeightClass} ${
              disabled
                ? "border-slate-200 bg-slate-50 cursor-not-allowed"
                : uploading
                ? "border-blue-300 bg-blue-50"
                : "border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50 cursor-pointer"
            }`}
          >
            {uploading ? (
              <>
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-sm text-blue-600">กำลังอัปโหลด...</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-slate-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">คลิกเพื่ออัปโหลดรูปภาพ</p>
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
