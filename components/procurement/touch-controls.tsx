"use client"

import { useMemo, useState } from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { GlassDialog } from "@/components/glass/glass-dialog"
import { cn } from "@/lib/utils"

/** Row of large toggle buttons; one value is always selected. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  columns,
}: {
  label?: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  disabled?: boolean
  columns?: number
}) {
  return (
    <div className="space-y-1.5">
      {label ? <span className="block text-base font-medium text-foreground">{label}</span> : null}
      <div
        role="radiogroup"
        aria-label={label}
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
      >
        {options.map((opt) => {
          const active = opt.value === value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={cn(
                "min-h-12 rounded-xl border px-2 text-base font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                active
                  ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                  : "border-border bg-background text-foreground hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export type PickerOption = { value: string; label: string; hint?: string | null }

/** Field that opens a full list with search; every row is a large tap target. */
export function TouchPicker({
  label,
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  required,
  disabled,
  error,
  footer,
  compact,
}: {
  label: string
  value: string
  options: PickerOption[]
  onChange: (value: string) => void
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  required?: boolean
  disabled?: boolean
  error?: string
  footer?: React.ReactNode
  /** Hides the label so the field can sit in a one-line row. The label stays on the button for screen readers. */
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selected = options.find((o) => o.value === value)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q))
  }, [options, query])

  return (
    <div className={compact ? undefined : "space-y-1.5"}>
      {compact ? null : (
        <span className="block text-base font-medium text-foreground">
          {label}
          {required ? <span className="ml-1 text-red-500">*</span> : null}
        </span>
      )}
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={() => {
          setQuery("")
          setOpen(true)
        }}
        className={cn(
          "flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border bg-background px-3 py-2 text-left text-base transition-colors",
          "disabled:cursor-not-allowed disabled:bg-muted",
          error ? "border-red-400" : "border-input hover:border-slate-400"
        )}
      >
        <span className={cn("min-w-0 truncate", selected ? "text-foreground" : "text-muted-foreground")}>
          {selected ? selected.label : placeholder}
          {!compact && selected?.hint ? <span className="ml-2 text-sm text-muted-foreground">{selected.hint}</span> : null}
        </span>
        {!disabled && <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />}
      </button>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <GlassDialog open={open} onOpenChange={setOpen} title={label} solid>
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-12 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-base text-muted-foreground">{emptyText}</li>
            ) : (
              filtered.map((o) => {
                const active = o.value === value
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(o.value)
                        setOpen(false)
                      }}
                      className={cn(
                        "flex min-h-12 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-base",
                        active ? "bg-blue-50 font-semibold text-blue-800" : "text-foreground hover:bg-muted"
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{o.label}</span>
                        {o.hint ? <span className="block truncate text-sm text-muted-foreground">{o.hint}</span> : null}
                      </span>
                      {active ? <Check className="h-5 w-5 shrink-0" /> : null}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
          {footer ? <div className="text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </GlassDialog>
    </div>
  )
}

/** Labeled block used for every field on the order form: label above, 16px text, 48px tall. */
export const touchInputClass =
  "h-12 w-full rounded-xl border border-input bg-background px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-muted"
