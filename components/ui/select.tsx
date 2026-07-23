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
          <label htmlFor={selectId} className="block text-sm font-medium text-slate-700">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            {...props}
            className={cn(
              "w-full border rounded-lg text-sm text-slate-800 appearance-none pr-8 px-3 py-2 transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              error
                ? "border-red-400 bg-red-50"
                : "border-slate-300 bg-white hover:border-slate-400",
              props.disabled && "bg-slate-50 text-slate-400 cursor-not-allowed",
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
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
    )
  }
)

Select.displayName = "Select"
