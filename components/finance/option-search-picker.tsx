"use client"

import { useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"
import { GlassDialog } from "@/components/glass"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Option } from "./expense-types"

export function OptionSearchPicker({
  label,
  required,
  value,
  onChange,
  options,
  emptyLabel,
  title,
  searchPlaceholder,
  emptyResult,
}: {
  label: string
  required?: boolean
  value: string
  onChange: (id: string) => void
  options: Option[]
  emptyLabel: string
  title: string
  searchPlaceholder: string
  emptyResult: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selected = options.find((option) => option.id === value)
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((option) => option.name.toLowerCase().includes(q))
  }, [options, query])

  function choose(id: string) {
    onChange(id)
    setOpen(false)
  }

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setQuery("")
          setOpen(true)
        }}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-left text-sm text-foreground hover:border-slate-400 dark:border-slate-500 dark:bg-slate-950/55 dark:hover:border-slate-400"
      >
        <span className="min-w-0 truncate">{selected?.name ?? emptyLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      <GlassDialog open={open} onOpenChange={setOpen} title={title} className="max-w-md" solid>
        <div className="space-y-3">
          <Input
            autoFocus
            value={query}
            placeholder={searchPlaceholder}
            onChange={(e) => setQuery(e.target.value)}
            className="py-2.5 text-base"
          />
          <div className="max-h-80 space-y-1 overflow-y-auto" role="listbox" aria-label={label}>
            <button
              type="button"
              onClick={() => choose("")}
              className="flex w-full rounded-lg px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted"
            >
              {emptyLabel}
            </button>
            {matches.map((option) => {
              const active = option.id === value
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => choose(option.id)}
                  className={cn(
                    "flex w-full rounded-lg px-3 py-2.5 text-left text-sm",
                    active ? "bg-[#2563eb] text-white" : "text-foreground hover:bg-muted"
                  )}
                >
                  <span className="min-w-0 truncate">{option.name}</span>
                </button>
              )
            })}
            {matches.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-foreground">{emptyResult}</p>
            )}
          </div>
        </div>
      </GlassDialog>
    </div>
  )
}
