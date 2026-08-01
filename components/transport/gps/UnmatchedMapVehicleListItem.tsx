"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import type { GpsVehicleData } from "@/app/api/transport/gps/route"
import { ExternalLink, AlertTriangle } from "lucide-react"

const VEHICLES_MASTER_HREF = "/transport/master-data?tab=vehicles"

type Props = {
  vehicle: GpsVehicleData
  selected?: boolean
  onClick?: () => void
}

export function UnmatchedMapVehicleListItem({ vehicle: v, selected, onClick }: Props) {
  return (
    <li
      onClick={onClick}
      className={cn(
        "cursor-pointer border-b border-amber-100 px-4 py-3 transition-colors bg-amber-50/40",
        selected && "bg-amber-100 border-l-4 border-l-amber-500",
        !selected && "hover:bg-amber-50/70"
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-foreground">
              {v.plateNumber || "—"}
            </span>
            <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
              ไม่ match DB
            </span>
          </div>
          {v.imei && (
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">IMEI: {v.imei}</p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground truncate">
            {v.address || v.near || "ไม่มีที่อยู่"}
          </p>
          <Link
            href={VEHICLES_MASTER_HREF}
            onClick={(e) => e.stopPropagation()}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 underline hover:text-amber-950"
          >
            <ExternalLink className="h-3 w-3" />
            ไปเพิ่ม/ผูกที่ข้อมูลพื้นฐาน
          </Link>
        </div>
      </div>
    </li>
  )
}
