import { cn } from "@/lib/utils"

interface GlassNavbarProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode
}

export function GlassNavbar({ children, className, ...props }: GlassNavbarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-white/30 bg-transparent px-6 backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10",
        className
      )}
      {...props}
    >
      {children}
    </header>
  )
}
