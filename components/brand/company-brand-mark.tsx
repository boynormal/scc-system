"use client"

import { Wrench } from "lucide-react"
import { cn } from "@/lib/utils"

type Size = "sm" | "md" | "lg"

const SIZE: Record<
  Size,
  { box: string; icon: string; img: string }
> = {
  sm: { box: "h-9 w-9 rounded-lg", icon: "h-5 w-5", img: "h-9 w-9" },
  md: { box: "h-12 w-12 rounded-xl", icon: "h-6 w-6", img: "h-12 w-12" },
  lg: { box: "h-16 w-16 rounded-2xl", icon: "h-8 w-8", img: "h-16 w-16" },
}

type Props = {
  logoUrl?: string | null
  size?: Size
  className?: string
  /** Accessible name for the mark */
  alt?: string
}

/**
 * เครื่องหมายแบรนด์บริษัท — โลโก้ที่อัปโหลด หรือ fallback ไอคอนประแจ
 */
export function CompanyBrandMark({
  logoUrl,
  size = "sm",
  className,
  alt = "Logo",
}: Props) {
  const s = SIZE[size]

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- company logo from public/home-screen with cache-bust query
      <img
        src={logoUrl}
        alt={alt}
        className={cn(
          s.img,
          "shrink-0 object-cover shadow-sm ring-1 ring-black/10 dark:ring-white/15",
          s.box,
          className
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center bg-gradient-to-br from-blue-600 to-blue-700 shadow-sm",
        s.box,
        className
      )}
      aria-hidden={alt ? undefined : true}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
    >
      <Wrench className={cn(s.icon, "text-white")} />
    </div>
  )
}
