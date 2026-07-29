import { cn } from "@/lib/utils"
import { GlassSurface } from "./glass-surface"

interface GlassFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode
  className?: string
  /** When true, wraps fields in a default glass surface */
  surfaced?: boolean
}

export function GlassForm({
  children,
  className,
  surfaced = false,
  ...props
}: GlassFormProps) {
  const body = <div className={cn("space-y-5", !surfaced && className)}>{children}</div>

  if (!surfaced) {
    return (
      <form {...props} className={className}>
        {body}
      </form>
    )
  }

  return (
    <form {...props}>
      <GlassSurface intensity="default" className={cn("space-y-5 rounded-glass p-5", className)}>
        {children}
      </GlassSurface>
    </form>
  )
}

export function GlassFormSection({
  title,
  description,
  children,
  className,
}: {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("space-y-3", className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          )}
          {description && <p className="text-xs text-muted-foreground dark:text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export function GlassFormActions({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2 border-t border-glass pt-4",
        className
      )}
    >
      {children}
    </div>
  )
}
