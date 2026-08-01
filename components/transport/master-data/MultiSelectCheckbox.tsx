"use client"

import { cn } from "@/lib/utils"

type MultiSelectCheckboxProps = {
  options: readonly string[]
  value: string[]
  onChange: (value: string[]) => void
  className?: string
}

export function MultiSelectCheckbox({ options, value, onChange, className }: MultiSelectCheckboxProps) {
  const toggle = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter((v) => v !== option))
    } else {
      onChange([...value, option])
    }
  }

  return (
    <div className={cn("h-44 overflow-y-auto rounded-lg border border-cyan-200 bg-card p-2.5 space-y-1.5 min-w-[180px]", className)}>
      {options.map((option) => (
        <label key={option} className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm text-foreground hover:bg-muted/60">
          <input
            type="checkbox"
            checked={value.includes(option)}
            onChange={() => toggle(option)}
            className="mt-0.5 size-4 rounded border-border text-cyan-600 focus:ring-cyan-500"
          />
          <span className="leading-snug">{option}</span>
        </label>
      ))}
    </div>
  )
}

export function MultiSelectDisplay({ value }: { value: string[] | null | undefined }) {
  if (!value?.length) return <span className="text-sm text-muted-foreground">—</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {value.map((item) => (
        <span key={item} className="inline-block rounded-md bg-muted px-2 py-1 text-sm leading-snug text-foreground">
          {item}
        </span>
      ))}
    </div>
  )
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === "string")
}

export { parseStringArray }
