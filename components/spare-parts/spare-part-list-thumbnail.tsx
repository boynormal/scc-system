"use client"

import { useState } from "react"
import { Package, AlertTriangle } from "lucide-react"

export function SparePartListThumbnail({
  imageUrl,
  name,
  isLowStock,
}: {
  imageUrl: string | null | undefined
  name: string
  isLowStock: boolean
}) {
  const [failed, setFailed] = useState(false)
  const url = imageUrl?.trim() || ""

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name}
        width={32}
        height={32}
        className="w-8 h-8 rounded-lg object-cover shrink-0 bg-white ring-1 ring-slate-200/80"
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <div
      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
        isLowStock ? "bg-orange-100" : "bg-slate-100"
      }`}
      title={isLowStock ? "ใกล้หมด / ไม่มีรูป" : undefined}
    >
      {isLowStock ? (
        <AlertTriangle className="w-4 h-4 text-orange-500" aria-hidden />
      ) : (
        <Package className="w-4 h-4 text-slate-500" aria-hidden />
      )}
    </div>
  )
}
