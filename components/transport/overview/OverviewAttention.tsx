import type { ReactNode } from "react"
import Link from "next/link"
import { AlertTriangle, CalendarDays, ClipboardList, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"

type Item = {
  href: string
  label: string
  value: number
  hint: string
  tone: "amber" | "cyan" | "red" | "slate"
  icon: ReactNode
}

const TONE: Record<Item["tone"], { idle: string; hot: string; icon: string }> = {
  amber: {
    idle: "border-slate-200 bg-white text-slate-600 dark:border-border dark:bg-card dark:text-muted-foreground",
    hot: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200",
  },
  cyan: {
    idle: "border-slate-200 bg-white text-slate-600 dark:border-border dark:bg-card dark:text-muted-foreground",
    hot: "border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100",
    icon: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-200",
  },
  red: {
    idle: "border-slate-200 bg-white text-slate-600 dark:border-border dark:bg-card dark:text-muted-foreground",
    hot: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100",
    icon: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200",
  },
  slate: {
    idle: "border-slate-200 bg-white text-slate-600 dark:border-border dark:bg-card dark:text-muted-foreground",
    hot: "border-slate-300 bg-slate-100 text-slate-900 dark:border-border dark:bg-muted dark:text-foreground",
    icon: "bg-slate-200 text-slate-700 dark:bg-muted dark:text-foreground",
  },
}

export function OverviewAttention({
  pendingAssignment,
  scheduledToday,
  openRepairs,
  vehiclesMaintenance,
}: {
  pendingAssignment: number
  scheduledToday: number
  openRepairs: number
  vehiclesMaintenance: number
}) {
  const items: Item[] = [
    {
      href: "/transport/jobs",
      label: "รอมอบหมาย",
      value: pendingAssignment,
      hint: "ใบงานที่ยังไม่มีรถ/คนขับ",
      tone: "amber",
      icon: <ClipboardList className="h-5 w-5" />,
    },
    {
      href: "/transport/calendar",
      label: "นัดวิ่งวันนี้",
      value: scheduledToday,
      hint: "งานที่กำหนดวันนี้ (ยังไม่จบ)",
      tone: "cyan",
      icon: <CalendarDays className="h-5 w-5" />,
    },
    {
      href: "/transport/repairs",
      label: "แจ้งซ่อมเปิด",
      value: openRepairs,
      hint: "แจ้งซ่อม + กำลังซ่อม",
      tone: "red",
      icon: <Wrench className="h-5 w-5" />,
    },
    {
      href: "/transport/master-data?tab=vehicles",
      label: "รถซ่อมบำรุง",
      value: vehiclesMaintenance,
      hint: "สถานะรถ = ซ่อมบำรุง",
      tone: "slate",
      icon: <AlertTriangle className="h-5 w-5" />,
    },
  ]

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-foreground">ต้องทำ</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const hot = item.value > 0
          const tone = TONE[item.tone]
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={cn(
                "group flex items-start gap-3 rounded-xl border p-4 shadow-sm transition-colors hover:shadow-md",
                hot ? tone.hot : tone.idle
              )}
            >
              <div className={cn("rounded-lg p-2", hot ? tone.icon : "bg-slate-100 text-slate-500 dark:bg-muted dark:text-muted-foreground")}>
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("text-3xl font-bold tabular-nums tracking-tight", !hot && "opacity-70")}>
                  {item.value}
                </p>
                <p className="mt-0.5 text-sm font-semibold">{item.label}</p>
                <p className="mt-0.5 text-xs opacity-70">{item.hint}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
