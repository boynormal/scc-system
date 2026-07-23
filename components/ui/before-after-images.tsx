"use client"

import { useState } from "react"
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react"
import Image from "next/image"

interface BeforeAfterImagesProps {
  beforeImages?: string[]
  afterImages?: string[]
  onBeforeChange?: (images: string[]) => void
  onAfterChange?: (images: string[]) => void
  disabled?: boolean
  maxImages?: number
}

export function BeforeAfterImages({
  beforeImages = [],
  afterImages = [],
  onBeforeChange,
  onAfterChange,
  disabled,
  maxImages = 5,
}: BeforeAfterImagesProps) {
  const [before, setBefore] = useState<string[]>(beforeImages)
  const [after, setAfter] = useState<string[]>(afterImages)
  const [uploadingBefore, setUploadingBefore] = useState(false)
  const [uploadingAfter, setUploadingAfter] = useState(false)

  const handleUpload = async (
    files: FileList | null,
    type: "before" | "after"
  ) => {
    if (!files?.length) return

    const currentImages = type === "before" ? before : after
    const setImages = type === "before" ? setBefore : setAfter
    const setUploading = type === "before" ? setUploadingBefore : setUploadingAfter
    const onChange = type === "before" ? onBeforeChange : onAfterChange

    if (currentImages.length + files.length > maxImages) {
      alert(`สามารถอัปโหลดได้สูงสุด ${maxImages} รูป`)
      return
    }

    setUploading(true)
    const uploaded: string[] = []

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue
      if (file.size > 5 * 1024 * 1024) {
        alert(`ไฟล์ ${file.name} มีขนาดใหญ่เกิน 5MB`)
        continue
      }

      const formData = new FormData()
      formData.append("file", file)

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })
        if (!res.ok) throw new Error("Upload failed")
        const data = await res.json()
        uploaded.push(data.data.fileUrl)
      } catch (err) {
        console.error("Upload error:", err)
        alert(`อัปโหลด ${file.name} ไม่สำเร็จ`)
      }
    }

    const updated = [...currentImages, ...uploaded]
    setImages(updated)
    onChange?.(updated)
    setUploading(false)
  }

  const handleRemove = (index: number, type: "before" | "after") => {
    const currentImages = type === "before" ? before : after
    const setImages = type === "before" ? setBefore : setAfter
    const onChange = type === "before" ? onBeforeChange : onAfterChange

    const updated = currentImages.filter((_, i) => i !== index)
    setImages(updated)
    onChange?.(updated)
  }

  const renderImageSection = (
    title: string,
    images: string[],
    uploading: boolean,
    type: "before" | "after"
  ) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700">
          {title}
          <span className="text-slate-400 text-xs ml-2">
            ({images.length}/{maxImages})
          </span>
        </label>
        {!disabled && images.length < maxImages && (
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleUpload(e.target.files, type)}
              disabled={uploading}
              className="hidden"
            />
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors">
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังอัปโหลด...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>เพิ่มรูป</span>
                </>
              )}
            </div>
          </label>
        )}
      </div>

      {images.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
          <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-1" />
          <p className="text-xs text-slate-400">ยังไม่มีรูปภาพ</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {images.map((img, idx) => (
            <div
              key={idx}
              className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200"
            >
              <Image src={img} alt={`${title} ${idx + 1}`} fill sizes="(max-width: 768px) 100vw, 300px" className="object-cover" />
              {!disabled && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => handleRemove(idx, type)}
                    className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-5">
      {renderImageSection("รูปก่อนซ่อม", before, uploadingBefore, "before")}
      {renderImageSection("รูปหลังซ่อม", after, uploadingAfter, "after")}
    </div>
  )
}
