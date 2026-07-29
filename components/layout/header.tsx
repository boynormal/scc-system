"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { Grid3X3, LogOut, User } from "lucide-react"
import NotificationBell from "@/components/layout/notification-bell"
import NavCommandPalette from "@/components/layout/nav-command-palette"
import { GlassNavbar } from "@/components/glass"
import type { ModuleNavNode } from "@/shared/navigation/moduleRegistry"

interface HeaderProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
  navItems: ModuleNavNode[]
}

export default function Header({ user, navItems }: HeaderProps) {
  const pathname = usePathname()
  const isAppsPage = pathname === "/apps" || pathname.startsWith("/apps/")
  const isApp2Page = pathname === "/app2" || pathname.startsWith("/app2/")
  return (
    <GlassNavbar>
      <div className="flex items-center gap-2">
        <NavCommandPalette navItems={navItems} />
      </div>
      <div className="flex items-center gap-3">
        {!isAppsPage && (
          <Link
            href="/apps"
            className="inline-flex items-center gap-2 rounded-lg border border-glass bg-glass px-3 py-1.5 text-sm font-medium text-foreground backdrop-blur-glass transition hover:bg-glass-strong"
          >
            <Grid3X3 className="h-4 w-4" />
            {isApp2Page ? "หน้าหลัก" : "Apps"}
          </Link>
        )}
        <NotificationBell />

        <div className="flex items-center gap-2.5 border-l border-glass pl-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
            <User className="h-4 w-4 text-blue-600 dark:text-blue-300" />
          </div>
          <div className="text-sm">
            <p className="font-medium leading-none text-foreground">{user.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{user.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="ml-1 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
            title="ออกจากระบบ"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </GlassNavbar>
  )
}
