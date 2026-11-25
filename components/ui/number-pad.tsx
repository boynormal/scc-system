"use client"

import { Delete } from "lucide-react"

export const PAD_KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ".", "back"] as const
export type PadKey = (typeof PAD_KEYS)[number]

/** Next value after one key press, or null when the key is refused (second dot, too many decimals). */
export function typeDigit(current: string, key: string, maxDecimals: number, replace: boolean): string | null {
  if (key === "back") return replace ? "" : current.slice(0, -1)
  let base = replace ? "" : current
  if (key === ".") {
    if (base.includes(".")) return null
    return `${base === "" ? "0" : base}.`
  }
  if (base === "0") base = ""
  const dot = base.indexOf(".")
  if (dot >= 0 && base.length - dot - 1 >= maxDecimals) return null
  return base + key
}

/** Large on-screen keypad for touch entry. The display shows the value of the active field. */
export function NumberPad({
  label,
  value,
  suffix,
  disabled,
  onKey,
}: {
  label: string
  value: string
  suffix?: string
  disabled?: boolean
  onKey: (key: PadKey) => void
}) {
  return (
    <>
      <div className="rounded-xl bg-muted px-4 py-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <div className="mt-1 flex items-end justify-between gap-2">
          <span className="min-w-0 truncate text-3xl font-semibold tabular-nums text-foreground">{value || "0"}</span>
          {suffix ? <span className="pb-1 text-sm text-foreground">{suffix}</span> : null}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {PAD_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-label={key === "back" ? "ลบตัวเลข" : key}
            disabled={disabled}
            onClick={() => onKey(key)}
            className="inline-flex min-h-14 items-center justify-center rounded-xl border border-border bg-background text-xl font-semibold text-foreground shadow-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {key === "back" ? <Delete className="h-5 w-5" /> : key}
          </button>
        ))}
      </div>
    </>
  )
}
