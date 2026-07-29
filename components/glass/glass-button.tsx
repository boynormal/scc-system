import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

type GlassButtonVariant = "primary" | "glass" | "ghost" | "danger" | "outline"
type GlassButtonSize = "sm" | "md" | "lg"

const variantStyles: Record<GlassButtonVariant, string> = {
  primary: "bg-blue-600 text-white shadow-sm hover:bg-blue-700",
  glass:
    "border border-glass bg-glass text-foreground shadow-glass backdrop-blur-glass hover:bg-glass-strong",
  ghost:
    "text-muted-foreground hover:bg-white/40 hover:text-foreground dark:hover:bg-white/10",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
  outline:
    "border border-border text-foreground hover:bg-white/50 dark:hover:bg-white/10",
}

const sizeStyles: Record<GlassButtonSize, string> = {
  sm: "gap-1.5 px-3 py-1.5 text-xs",
  md: "gap-2 px-4 py-2 text-sm",
  lg: "gap-2 px-5 py-2.5 text-sm",
}

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GlassButtonVariant
  size?: GlassButtonSize
  loading?: boolean
  icon?: React.ReactNode
}

export function GlassButton({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...props
}: GlassButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glass-ring disabled:cursor-not-allowed disabled:opacity-50",
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
