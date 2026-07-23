import { cn } from "@/lib/utils"

type DetailsFieldProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  rows?: number
}

export function DetailsField({
  value,
  onChange,
  placeholder = "รายละเอียดเพิ่มเติม...",
  className,
  rows = 2,
}: DetailsFieldProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cn(
        "w-full min-w-[120px] rounded-lg border border-cyan-300 px-2 py-1.5 text-sm resize-y",
        "focus:outline-none focus:ring-2 focus:ring-cyan-500",
        className
      )}
    />
  )
}

export function DetailsDisplay({ value, expanded }: { value: string | null | undefined; expanded?: boolean }) {
  if (!value?.trim()) return <span className="text-slate-400">—</span>
  return (
    <span className={cn("text-slate-600 whitespace-pre-wrap", !expanded && "line-clamp-2")} title={value}>
      {value}
    </span>
  )
}
