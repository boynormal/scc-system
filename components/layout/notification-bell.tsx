"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Bell, Check, CheckCheck, Wrench, ClipboardList, AlertTriangle, Package, CalendarDays, X } from "lucide-react"
import { formatDateTime } from "@/lib/utils"

type Notification = {
  id: string
  type: string
  title: string
  message: string | null
  link: string | null
  isRead: boolean
  createdAt: string
}

const typeIcon: Record<string, React.ReactNode> = {
  overdue_schedule: <AlertTriangle className="w-4 h-4 text-red-500" />,
  upcoming_maintenance: <Wrench className="w-4 h-4 text-blue-500" />,
  wo_assigned: <ClipboardList className="w-4 h-4 text-purple-500" />,
  low_stock: <Package className="w-4 h-4 text-orange-500" />,
  wo_completed: <Check className="w-4 h-4 text-green-500" />,
  due_item_upcoming: <CalendarDays className="w-4 h-4 text-blue-500" />,
  due_item_overdue: <CalendarDays className="w-4 h-4 text-red-500" />,
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=15")
      if (!res.ok) return
      const json = await res.json()
      setNotifications(json.data ?? [])
      setUnreadCount(json.unreadCount ?? 0)
    } catch {}
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" })
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n))
    setUnreadCount((c) => Math.max(0, c - 1))
  }

  const markAllRead = async () => {
    await fetch("/api/notifications/read-all", { method: "POST" })
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground text-sm">การแจ้งเตือน</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  title="อ่านทั้งหมด"
                  className="p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-muted-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Bell className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">ไม่มีการแจ้งเตือน</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex gap-3 px-4 py-3 hover:bg-muted/60 transition-colors cursor-pointer ${!n.isRead ? "bg-blue-50/40" : ""}`}
                  onClick={() => {
                    if (!n.isRead) markRead(n.id)
                    if (n.link) window.location.href = n.link
                  }}
                >
                  <div className="mt-0.5 shrink-0 w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                    {typeIcon[n.type] ?? <Bell className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${!n.isRead ? "font-semibold text-foreground" : "text-foreground"}`}>
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="mt-1 w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                      )}
                    </div>
                    {n.message && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{formatDateTime(n.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
