import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline"
type ButtonSize = "sm" | "md" | "lg"

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-sm",
  secondary: "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100",
  danger: "bg-red-600 hover:bg-red-700 text-white shadow-sm",
  ghost: "hover:bg-slate-100 text-slate-600 hover:text-slate-900 dark:hover:bg-slate-700 dark:text-slate-300 dark:hover:text-slate-100",
  outline: "border border-slate-300 hover:bg-slate-50 text-slate-700 dark:border-slate-600 dark:hover:bg-slate-700 dark:text-slate-200",
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-5 py-2.5 text-sm gap-2",
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {(loading || icon) && (
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        </span>
      )}
      {children}
    </button>
  )
}
