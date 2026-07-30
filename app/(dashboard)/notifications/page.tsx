"use client"

import { useState, useEffect, useCallback } from "react"
import { Bell, CheckCheck, AlertTriangle, Wrench, ClipboardList, Package, Check, RefreshCw } from "lucide-react"
import { useTranslations } from "next-intl"
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

const typeConfig: Record<string, { icon: React.ReactNode; label: string; bg: string }> = {
  overdue_schedule: { icon: <AlertTriangle className="w-4 h-4 text-red-500" />, label: "กำหนดการเกินกำหนด", bg: "bg-red-50" },
  upcoming_maintenance: { icon: <Wrench className="w-4 h-4 text-blue-500" />, label: "กำหนดการใกล้ถึง", bg: "bg-blue-50" },
  wo_assigned: { icon: <ClipboardList className="w-4 h-4 text-purple-500" />, label: "มอบหมายงาน", bg: "bg-purple-50" },
  low_stock: { icon: <Package className="w-4 h-4 text-orange-500" />, label: "อะไหล่ใกล้หมด", bg: "bg-orange-50" },
  wo_completed: { icon: <Check className="w-4 h-4 text-green-500" />, label: "งานเสร็จสิ้น", bg: "bg-green-50" },
}

export default function NotificationsPage() {
  const t = useTranslations("notifications")
  const tCommon = useTranslations("common")
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "unread">("all")

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/notifications?limit=50${filter === "unread" ? "&unreadOnly=true" : ""}`)
    const json = await res.json()
    setNotifications(json.data ?? [])
    setUnreadCount(json.unreadCount ?? 0)
    setLoading(false)
  }, [filter])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {unreadCount > 0 ? t("unreadCount", { count: unreadCount }) : t("allRead")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchNotifications}
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground border border-border hover:bg-muted/60 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {tCommon("refresh")}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              {t("markAllRead")}
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? tCommon("all") : `${t("filterUnread")}${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Bell className="w-12 h-12 mb-3 opacity-20" />
            <p className="font-medium">{t("empty")}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((n) => {
              const config = typeConfig[n.type]
              return (
                <div
                  key={n.id}
                  className={`flex gap-4 px-5 py-4 hover:bg-muted/60 transition-colors ${!n.isRead ? "bg-blue-50/30" : ""}`}
                >
                  <div className={`mt-0.5 shrink-0 w-10 h-10 ${config?.bg ?? "bg-muted"} rounded-full flex items-center justify-center`}>
                    {config?.icon ?? <Bell className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className={`text-sm ${!n.isRead ? "font-semibold text-foreground" : "text-foreground"}`}>
                          {n.title}
                        </p>
                        {n.message && (
                          <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          {config && (
                            <span className="text-xs text-muted-foreground">{config.label}</span>
                          )}
                          <span className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!n.isRead && (
                          <>
                            <span className="w-2 h-2 bg-blue-500 rounded-full" />
                            <button
                              onClick={() => markRead(n.id)}
                              className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {t("markRead")}
                            </button>
                          </>
                        )}
                        {n.link && (
                          <a
                            href={n.link}
                            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                          >
                            ดูรายละเอียด →
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
