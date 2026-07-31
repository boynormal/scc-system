import { cn } from "@/lib/utils"
import { forwardRef } from "react"
import { ChevronDown } from "lucide-react"

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options?: SelectOption[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, className, id, children, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-")
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-foreground">
            {label}
            {props.required && <span className="ml-1 text-red-500">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            {...props}
            className={cn(
              "w-full appearance-none rounded-lg border px-3 py-2 pr-8 text-sm text-foreground transition-colors",
              "border-input bg-background dark:border-slate-500 dark:bg-slate-950/55",
              "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500",
              error
                ? "border-red-400 bg-red-50 dark:border-red-400 dark:bg-red-950/40"
                : "hover:border-slate-400 dark:hover:border-slate-400",
              props.disabled && "cursor-not-allowed bg-muted text-muted-foreground",
              className
            )}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    )
  }
)

Select.displayName = "Select"
