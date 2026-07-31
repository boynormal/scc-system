import { cn } from "@/lib/utils"
import { forwardRef } from "react"

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: React.ReactNode
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, error, hint, icon, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-")
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground"
          >
            {label}
            {props.required && <span className="ml-1 text-red-500">*</span>}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            {...props}
            className={cn(
              "w-full rounded-lg border text-sm text-foreground placeholder:text-muted-foreground/80 transition-colors",
              // Solid field + input rim — avoid border-glass (maps to glass fill, invisible on cards)
              "border-input bg-background dark:border-slate-500 dark:bg-slate-950/55",
              "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-glass-ring",
              icon ? "py-2 pl-9 pr-3" : "px-3 py-2",
              error
                ? "border-red-400 bg-red-50/80 focus:ring-red-400 dark:border-red-400 dark:bg-red-950/40"
                : "hover:border-slate-400 dark:hover:border-slate-400",
              props.disabled &&
                "cursor-not-allowed bg-muted/80 text-muted-foreground dark:bg-slate-900/60",
              className
            )}
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    )
  }
)

GlassInput.displayName = "GlassInput"
