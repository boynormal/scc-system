"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const hiddenScrollbar =
  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"

export function DashboardScroll({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const hideScrollbar = pathname === "/apps"

  return (
    <div
      className={cn(
        "relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto",
        hideScrollbar && hiddenScrollbar
      )}
    >
      {children}
    </div>
  )
}
