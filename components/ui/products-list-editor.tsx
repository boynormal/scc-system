"use client"

import { useState } from "react"
import { Plus, Trash2, GripVertical, Loader2, Image as ImageIcon, Upload, X } from "lucide-react"
import Image from "next/image"

interface Product {
  id?: string
  name: string
  description?: string
  imageUrl?: string
  order: number
}

interface ProductsListEditorProps {
  machineId?: string
  initialProducts?: Product[]
  onProductsChange?: (products: Product[]) => void
  disabled?: boolean
}

export function ProductsListEditor({
  machineId,
  initialProducts = [],
  onProductsChange,
  disabled,
}: ProductsListEditorProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState<number | null>(null)

  const updateProducts = (updated: Product[]) => {
    setProducts(updated)
    onProductsChange?.(updated)
  }

  const handleAdd = () => {
    const newProduct: Product = { name: "", order: products.length }
    updateProducts([...products, newProduct])
  }

  const handleDelete = async (idx: number) => {
    const product = products[idx]
    if (product.id && machineId) {
      try {
        await fetch(`/api/machines/${machineId}/products/${product.id}`, {
          method: "DELETE",
        })
      } catch (err) {
        console.error(err)
      }
    }
    updateProducts(products.filter((_, i) => i !== idx))
  }

  const handleFieldChange = (idx: number, field: keyof Product, value: string) => {
    const updated = products.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    updateProducts(updated)
  }

  const handleFieldBlur = async (idx: number) => {
    const product = products[idx]
    if (!product.name.trim() || !machineId) return

    setSaving(idx)
    try {
      if (!product.id) {
        // New product — create via POST
        const res = await fetch(`/api/machines/${machineId}/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: product.name, description: product.description, order: product.order }),
        })
        if (res.ok) {
          const data = await res.json()
          const updated = products.map((p, i) => (i === idx ? { ...p, id: data.data?.id } : p))
          updateProducts(updated)
        }
      } else {
        // Existing product — update via PUT
        await fetch(`/api/machines/${machineId}/products/${product.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: product.name, description: product.description }),
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(null)
    }
  }

  const handleImageUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) { alert("กรุณาเลือกไฟล์รูปภาพ"); return }
    if (file.size > 5 * 1024 * 1024) { alert("ไฟล์ใหญ่เกิน 5MB"); return }

    setUploadingIdx(idx)
    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      if (!res.ok) throw new Error("Upload failed")
      const data = await res.json()
      const imageUrl = data.data.fileUrl

      const updated = products.map((p, i) => (i === idx ? { ...p, imageUrl } : p))
      updateProducts(updated)

      // Save to DB if machineId + productId exist
      const product = updated[idx]
      if (machineId && product.id) {
        await fetch(`/api/machines/${machineId}/products/${product.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl }),
        })
      }
    } catch (err) {
      alert("อัปโหลดไม่สำเร็จ")
    } finally {
      setUploadingIdx(null)
      e.target.value = ""
    }
  }

  const handleRemoveImage = async (idx: number) => {
    const product = products[idx]
    const updated = products.map((p, i) => (i === idx ? { ...p, imageUrl: undefined } : p))
    updateProducts(updated)

    if (machineId && product.id) {
      try {
        await fetch(`/api/machines/${machineId}/products/${product.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: "" }),
        })
      } catch (err) {
        console.error(err)
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700">
          รายการสินค้า/ผลิตภัณฑ์
          <span className="text-slate-400 text-xs ml-2">({products.length} รายการ)</span>
        </label>
        {!disabled && (
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            เพิ่มรายการ
          </button>
        )}
      </div>

      {products.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
          <p className="text-sm text-slate-400">ยังไม่มีรายการสินค้า กดปุ่ม "เพิ่มรายการ" เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product, idx) => (
            <div
              key={product.id ?? idx}
              className="border border-slate-200 rounded-xl bg-white shadow-sm"
            >
              <div className="flex gap-3 p-4">
                {/* Drag handle (visual only) */}
                <div className="flex items-start pt-1 text-slate-300">
                  <GripVertical className="w-5 h-5" />
                </div>

                {/* Image section */}
                <div className="shrink-0">
                  {product.imageUrl ? (
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 group">
                      <Image src={product.imageUrl} alt={product.name || "Product"} fill sizes="(max-width: 768px) 100vw, 300px" className="object-cover" />
                      {!disabled && (
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <X className="w-5 h-5 text-white" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <label className="cursor-pointer block w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 transition-colors flex flex-col items-center justify-center gap-1">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={disabled || uploadingIdx === idx}
                        onChange={(e) => handleImageUpload(idx, e)}
                      />
                      {uploadingIdx === idx ? (
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                      ) : (
                        <>
                          <ImageIcon className="w-5 h-5 text-slate-400" />
                          <span className="text-xs text-slate-400">รูปภาพ</span>
                        </>
                      )}
                    </label>
                  )}
                </div>

                {/* Fields */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={product.name}
                      placeholder="ชื่อสินค้า / ผลิตภัณฑ์ *"
                      disabled={disabled}
                      onChange={(e) => handleFieldChange(idx, "name", e.target.value)}
                      onBlur={() => handleFieldBlur(idx)}
                      className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                    />
                    {saving === idx && <Loader2 className="w-4 h-4 text-slate-400 animate-spin shrink-0" />}
                  </div>
                  <textarea
                    value={product.description ?? ""}
                    placeholder="รายละเอียดสินค้า (ไม่บังคับ)"
                    rows={2}
                    disabled={disabled}
                    onChange={(e) => handleFieldChange(idx, "description", e.target.value)}
                    onBlur={() => handleFieldBlur(idx)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-slate-50"
                  />
                </div>

                {/* Delete */}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleDelete(idx)}
                    className="shrink-0 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
