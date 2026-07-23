"use client"

import { useState } from "react"
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react"
import Image from "next/image"

interface ImageItem {
  id?: string
  fileUrl: string
  fileName?: string
  isPrimary?: boolean
}

interface MultiImageUploadProps {
  machineId?: string
  initialImages?: ImageItem[]
  onImagesChange?: (images: ImageItem[]) => void
  maxImages?: number
  disabled?: boolean
}

export function MultiImageUpload({
  machineId,
  initialImages = [],
  onImagesChange,
  maxImages = 10,
  disabled,
}: MultiImageUploadProps) {
  const [images, setImages] = useState<ImageItem[]>(initialImages)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const processFiles = async (files: File[]) => {
    if (!files.length) return

    if (images.length + files.length > maxImages) {
      alert(`สามารถอัปโหลดได้สูงสุด ${maxImages} รูป`)
      return
    }

    setUploading(true)

    for (const file of files) {
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

        const newImage: ImageItem = {
          fileUrl: data.data.fileUrl,
          fileName: data.data.fileName,
          isPrimary: images.length === 0,
        }

        // If machineId exists, save to database
        if (machineId) {
          const saveRes = await fetch(`/api/machines/${machineId}/images`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newImage),
          })
          if (saveRes.ok) {
            const saved = await saveRes.json()
            newImage.id = saved.data.id
          }
        }

        setImages((prev) => {
          const updated = [...prev, newImage]
          onImagesChange?.(updated)
          return updated
        })
      } catch (err) {
        console.error("Upload error:", err)
        alert(`อัปโหลด ${file.name} ไม่สำเร็จ`)
      }
    }

    setUploading(false)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await processFiles(Array.from(e.target.files || []))
    e.target.value = ""
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled || uploading) return
    await processFiles(Array.from(e.dataTransfer.files))
  }

  const handleRemove = async (index: number) => {
    const image = images[index]
    
    // If has ID and machineId, delete from database
    if (image.id && machineId) {
      try {
        await fetch(`/api/machines/${machineId}/images/${image.id}`, {
          method: "DELETE",
        })
      } catch (err) {
        console.error("Delete error:", err)
      }
    }

    setImages((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      onImagesChange?.(updated)
      return updated
    })
  }

  const handleSetPrimary = async (index: number) => {
    setImages((prev) => {
      const updated = prev.map((img, i) => ({
        ...img,
        isPrimary: i === index,
      }))
      onImagesChange?.(updated)
      return updated
    })

    // Update in database if exists
    const image = images[index]
    if (image.id && machineId) {
      try {
        await fetch(`/api/machines/${machineId}/images/${image.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPrimary: true }),
        })
      } catch (err) {
        console.error("Update error:", err)
      }
    }
  }

  return (
    <div 
      className={`space-y-3 rounded-xl transition-all duration-200 ${isDragging ? "bg-blue-50 outline-dashed outline-2 outline-blue-400 outline-offset-4 p-4 -m-4" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700">
          รูปภาพเครื่องจักร
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
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังอัปโหลด...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>เพิ่มรูปภาพ</span>
                </>
              )}
            </div>
          </label>
        )}
      </div>

      {images.length === 0 ? (
        <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}>
          <ImageIcon className={`w-12 h-12 mx-auto mb-2 ${isDragging ? "text-blue-500" : "text-slate-300"}`} />
          <p className="text-sm font-medium text-slate-600 mb-1">ลากและวางรูปภาพที่นี่</p>
          <p className="text-xs text-slate-400">หรือคลิกปุ่ม "เพิ่มรูปภาพ" ด้านบน</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((img, idx) => (
            <div
              key={idx}
              className={`relative group aspect-square rounded-lg overflow-hidden border-2 ${
                img.isPrimary ? "border-blue-500" : "border-slate-200"
              }`}
            >
              <Image
                src={img.fileUrl}
                alt={img.fileName || `Image ${idx + 1}`}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover"
              />
              {!disabled && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!img.isPrimary && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(idx)}
                      className="px-2 py-1 bg-white text-slate-700 text-xs rounded hover:bg-slate-100"
                    >
                      ตั้งเป็นหลัก
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {img.isPrimary && (
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                  หลัก
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
