import { cn } from "@/lib/utils"
import { GlassSurface } from "./glass-surface"

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  padding?: "none" | "sm" | "md" | "lg"
}

const paddingMap = { none: "", sm: "p-4", md: "p-5", lg: "p-6" }

export function GlassCard({ children, className, padding = "md" }: GlassCardProps) {
  return (
    <GlassSurface
      intensity="default"
      className={cn(
        "overflow-hidden rounded-glass text-foreground",
        paddingMap[padding],
        className
      )}
    >
      {children}
    </GlassSurface>
  )
}

export function GlassCardHeader({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-4 flex items-center justify-between", className)}>{children}</div>
  )
}

export function GlassCardTitle({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <h3 className={cn("text-base font-semibold text-foreground", className)}>
      {children}
    </h3>
  )
}
