import type { ReactNode } from "react"
import { CheckCircle2, Truck, UserRound, Wrench, PlayCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type Kpi = {
  label: string
  value: number
  icon: ReactNode
  className: string
}

export function OverviewKpiRow({
  fleet,
  today,
}: {
  fleet: {
    vehiclesAvailable: number
    vehiclesOnJob: number
    vehiclesMaintenance: number
    driversAvailable: number
  }
  today: {
    jobsInProgress: number
    completedToday: number
    cancelledToday: number
  }
}) {
  const items: Kpi[] = [
    {
      label: "รถว่าง",
      value: fleet.vehiclesAvailable,
      icon: <Truck className="h-4 w-4" />,
      className: "text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "รถกำลังใช้งาน",
      value: fleet.vehiclesOnJob,
      icon: <PlayCircle className="h-4 w-4" />,
      className: "text-sky-700 dark:text-sky-300",
    },
    {
      label: "รถซ่อม",
      value: fleet.vehiclesMaintenance,
      icon: <Wrench className="h-4 w-4" />,
      className: "text-amber-700 dark:text-amber-300",
    },
    {
      label: "คนขับว่าง",
      value: fleet.driversAvailable,
      icon: <UserRound className="h-4 w-4" />,
      className: "text-slate-700 dark:text-slate-200",
    },
    {
      label: "งานกำลังทำ",
      value: today.jobsInProgress,
      icon: <PlayCircle className="h-4 w-4" />,
      className: "text-cyan-700 dark:text-cyan-300",
    },
    {
      label: "เสร็จวันนี้",
      value: today.completedToday,
      icon: <CheckCircle2 className="h-4 w-4" />,
      className: "text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "ยกเลิกวันนี้",
      value: today.cancelledToday,
      icon: <XCircle className="h-4 w-4" />,
      className: "text-slate-600 dark:text-muted-foreground",
    },
  ]

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-foreground">สถานะฟลีท & งานวันนี้</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-border dark:bg-card"
          >
            <div className={cn("mb-2 inline-flex items-center gap-1.5 text-xs font-medium", item.className)}>
              {item.icon}
              {item.label}
            </div>
            <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-foreground">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
