import { cn } from "@/lib/utils"

interface GlassNavbarProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode
}

export function GlassNavbar({ children, className, ...props }: GlassNavbarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-white/40 bg-white/70 px-6 backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-white/25 dark:border-white/10 dark:bg-slate-950/75 dark:supports-[backdrop-filter]:bg-slate-950/30",
        className
      )}
      {...props}
    >
      {children}
    </header>
  )
}
