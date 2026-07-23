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
    <div className={cn("max-h-36 overflow-y-auto rounded-lg border border-cyan-200 bg-white p-2 space-y-1.5 min-w-[180px]", className)}>
      {options.map((option) => (
        <label key={option} className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5">
          <input
            type="checkbox"
            checked={value.includes(option)}
            onChange={() => toggle(option)}
            className="mt-0.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
          />
          <span className="leading-snug">{option}</span>
        </label>
      ))}
    </div>
  )
}

export function MultiSelectDisplay({ value }: { value: string[] | null | undefined }) {
  if (!value?.length) return <span className="text-slate-400">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {value.map((item) => (
        <span key={item} className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 leading-tight">
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
