"use client"

import { Search } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  inputClassName?: string
}

export function TransportSearchField({
  value,
  onChange,
  placeholder = "ค้นหา...",
  className,
  inputClassName,
}: Props) {
  return (
    <div className={cn("relative min-w-0 max-w-sm flex-1", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500 dark:text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-border dark:bg-background dark:text-foreground dark:placeholder:text-muted-foreground",
          inputClassName
        )}
      />
    </div>
  )
}
