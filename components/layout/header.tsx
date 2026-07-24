"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { Grid3X3, LogOut, User } from "lucide-react"
import NotificationBell from "@/components/layout/notification-bell"
import NavCommandPalette from "@/components/layout/nav-command-palette"
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
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-2">
        <NavCommandPalette navItems={navItems} />
      </div>
      <div className="flex items-center gap-3">
        {!isAppsPage && (
          <Link
            href="/apps"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <Grid3X3 className="w-4 h-4" />
            {isApp2Page ? "หน้าหลัก" : "Apps"}
          </Link>
        )}
        <NotificationBell />

        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-slate-800 leading-none">{user.name}</p>
            <p className="text-slate-400 text-xs mt-0.5">{user.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1"
            title="ออกจากระบบ"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
