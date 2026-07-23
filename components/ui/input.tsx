import { cn } from "@/lib/utils"
import { forwardRef } from "react"

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-")
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>
          )}
          <input
            ref={ref}
            id={inputId}
            {...props}
            className={cn(
              "w-full border rounded-lg text-sm text-slate-800 placeholder-slate-400 transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              icon ? "pl-9 pr-3 py-2" : "px-3 py-2",
              error
                ? "border-red-400 bg-red-50 focus:ring-red-400"
                : "border-slate-300 bg-white hover:border-slate-400",
              props.disabled && "bg-slate-50 text-slate-400 cursor-not-allowed",
              className
            )}
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = "Input"
