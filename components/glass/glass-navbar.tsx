import { cn } from "@/lib/utils"
import { GlassSurface } from "./glass-surface"

interface GlassNavbarProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode
}

export function GlassNavbar({ children, className, ...props }: GlassNavbarProps) {
  return (
    <GlassSurface
      as="header"
      intensity="strong"
      className={cn(
        "sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between rounded-none border-x-0 border-t-0 px-6",
        className
      )}
      {...props}
    >
      {children}
    </GlassSurface>
  )
}
