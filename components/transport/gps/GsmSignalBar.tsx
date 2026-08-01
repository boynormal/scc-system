"use client"

import { Signal } from "lucide-react"
import { cn } from "@/lib/utils"
import { parseSignalPercent, signalBarColor } from "./gps-display-utils"

type Props = {
  gsm: string
  className?: string
  indent?: boolean
}

export function GsmSignalBar({ gsm, className, indent = true }: Props) {
  const pct = parseSignalPercent(gsm)
  if (pct === null) return null

  return (
    <div className={cn("flex items-center gap-2", indent && "pl-7", className)}>
      <Signal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="flex flex-1 items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className={cn("h-full rounded-full transition-all", signalBarColor(pct))}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[11px] font-medium text-muted-foreground w-8 text-right">{pct}%</span>
      </div>
    </div>
  )
}
