"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Bell, Check, CheckCheck, Wrench, ClipboardList, AlertTriangle, Package, X } from "lucide-react"
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
        className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 text-sm">การแจ้งเตือน</span>
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
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Bell className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">ไม่มีการแจ้งเตือน</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer ${!n.isRead ? "bg-blue-50/40" : ""}`}
                  onClick={() => {
                    if (!n.isRead) markRead(n.id)
                    if (n.link) window.location.href = n.link
                  }}
                >
                  <div className="mt-0.5 shrink-0 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                    {typeIcon[n.type] ?? <Bell className="w-4 h-4 text-slate-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${!n.isRead ? "font-semibold text-slate-800" : "text-slate-700"}`}>
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="mt-1 w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                      )}
                    </div>
                    {n.message && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">{formatDateTime(n.createdAt)}</p>
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
