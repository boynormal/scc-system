"use client"

import { useState } from "react"
import Image from "next/image"
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
      <Image
        src={url}
        alt={name}
        width={32}
        height={32}
        className="w-8 h-8 rounded-lg object-cover shrink-0 bg-card ring-1 ring-slate-200/80"
        unoptimized
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <div className="relative w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 ring-1 ring-slate-200/80">
      <Package className="w-4 h-4 text-muted-foreground" />
      {isLowStock && (
        <AlertTriangle className="absolute -top-1 -right-1 w-3.5 h-3.5 text-amber-500 fill-amber-50" />
      )}
    </div>
  )
}
