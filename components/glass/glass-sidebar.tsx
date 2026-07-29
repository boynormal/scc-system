import { cn } from "@/lib/utils"
import { GlassSurface } from "./glass-surface"

interface GlassSidebarProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode
}

export function GlassSidebar({ children, className, ...props }: GlassSidebarProps) {
  return (
    <GlassSurface
      as="aside"
      intensity="soft"
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-none border-y-0 border-l-0",
        className
      )}
      {...props}
    >
      {children}
    </GlassSurface>
  )
}
