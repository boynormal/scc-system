"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import type { WheelLayout } from "@/modules/transport/application/vehicle-wheel-layouts"

type WheelLayoutDiagramProps = {
  layout: WheelLayout
  /** Single-select (legacy). Ignored when `onTogglePosition` is provided. */
  selectedPosition?: number | null
  onSelectPosition?: (position: number) => void
  /** Multi-select: preferred for tire logs. */
  selectedPositions?: number[]
  onTogglePosition?: (position: number) => void
  compact?: boolean
  className?: string
}

export function WheelLayoutDiagram({
  layout,
  selectedPosition,
  onSelectPosition,
  selectedPositions,
  onTogglePosition,
  compact = false,
  className,
}: WheelLayoutDiagramProps) {
  const multi = typeof onTogglePosition === "function"
  const interactive = multi || typeof onSelectPosition === "function"
  const sizeClass = compact ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm"
  const selectedSet = useMemo(
    () => new Set(multi ? (selectedPositions ?? []) : selectedPosition != null ? [selectedPosition] : []),
    [multi, selectedPositions, selectedPosition]
  )

  const rows = useMemo(() => layout, [layout])

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <span>↑</span>
        <span>ด้านหน้ารถ</span>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3">
        {rows.map((axle, axleIdx) => (
          <div key={`axle-${axleIdx}`} className="flex items-center justify-center gap-2">
            {axle.map((pos) => {
              const selected = selectedSet.has(pos)
              const base =
                "inline-flex items-center justify-center rounded-md border font-medium transition-colors"
              const tone = selected
                ? "border-cyan-600 bg-cyan-600 text-white"
                : "border-border bg-background text-foreground hover:border-cyan-500"
              if (interactive) {
                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => {
                      if (multi) onTogglePosition?.(pos)
                      else onSelectPosition?.(pos)
                    }}
                    className={cn(base, sizeClass, tone)}
                    aria-pressed={selected}
                    title={`ตำแหน่ง ${pos}`}
                  >
                    {pos}
                  </button>
                )
              }
              return (
                <span key={pos} className={cn(base, sizeClass, "border-border bg-background")}>
                  {pos}
                </span>
              )
            })}
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">ด้านท้ายรถ</div>
    </div>
  )
}
