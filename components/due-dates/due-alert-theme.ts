import type { DueAlertLevel } from "./due-item-types"

export type DueTone = DueAlertLevel | "closed" | "cancelled"

export const DUE_GLASS_PANEL =
  "border-slate-300/70 bg-white/80 shadow-[0_10px_32px_rgb(15_23_42/0.12)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/15 dark:bg-slate-900/40 dark:shadow-[0_16px_48px_rgb(0_0_0/0.35)]"

export const DUE_GLASS_FIELD =
  "border-slate-300 bg-white/90 backdrop-blur-sm dark:border-white/15 dark:bg-slate-950/35"

export const ALERT_VISUAL: Record<
  DueTone,
  { bar: string; surface: string; ring: string; dot: string; text: string; chip: string }
> = {
  normal: {
    bar: "bg-emerald-500",
    surface: "border-emerald-300 bg-emerald-400/35 backdrop-blur-xl dark:border-emerald-400/25 dark:bg-emerald-500/15",
    ring: "ring-emerald-400",
    dot: "bg-emerald-500",
    text: "text-emerald-800 dark:text-emerald-200",
    chip: "border-emerald-300 bg-emerald-400/35 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/20 dark:text-emerald-200",
  },
  watch: {
    bar: "bg-sky-500",
    surface: "border-sky-300 bg-sky-400/35 backdrop-blur-xl dark:border-sky-400/25 dark:bg-sky-500/15",
    ring: "ring-sky-400",
    dot: "bg-sky-500",
    text: "text-sky-800 dark:text-sky-200",
    chip: "border-sky-300 bg-sky-400/35 text-sky-800 dark:border-sky-400/30 dark:bg-sky-500/20 dark:text-sky-200",
  },
  approaching: {
    bar: "bg-yellow-500",
    surface: "border-yellow-300 bg-yellow-400/35 backdrop-blur-xl dark:border-yellow-400/25 dark:bg-yellow-500/15",
    ring: "ring-yellow-400",
    dot: "bg-yellow-500",
    text: "text-yellow-900 dark:text-yellow-200",
    chip: "border-yellow-300 bg-yellow-400/35 text-yellow-900 dark:border-yellow-400/30 dark:bg-yellow-500/20 dark:text-yellow-200",
  },
  urgent: {
    bar: "bg-orange-500",
    surface: "border-orange-300 bg-orange-400/35 backdrop-blur-xl dark:border-orange-400/25 dark:bg-orange-500/15",
    ring: "ring-orange-400",
    dot: "bg-orange-500",
    text: "text-orange-800 dark:text-orange-200",
    chip: "border-orange-300 bg-orange-400/35 text-orange-800 dark:border-orange-400/30 dark:bg-orange-500/20 dark:text-orange-200",
  },
  expired: {
    bar: "bg-red-500",
    surface: "border-red-300 bg-red-400/35 backdrop-blur-xl dark:border-red-400/25 dark:bg-red-500/15",
    ring: "ring-red-400",
    dot: "bg-red-500",
    text: "text-red-800 dark:text-red-200",
    chip: "border-red-300 bg-red-400/35 text-red-800 dark:border-red-400/30 dark:bg-red-500/20 dark:text-red-200",
  },
  closed: {
    bar: "bg-slate-400",
    surface: "border-slate-300 bg-slate-200/50 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/30",
    ring: "ring-slate-400",
    dot: "bg-slate-400",
    text: "text-slate-600 dark:text-slate-300",
    chip: "border-slate-300 bg-slate-200/70 text-slate-600 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-300",
  },
  cancelled: {
    bar: "bg-slate-400",
    surface: "border-slate-300 bg-slate-200/50 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/30",
    ring: "ring-slate-400",
    dot: "bg-slate-400",
    text: "text-slate-600 dark:text-slate-300",
    chip: "border-slate-300 bg-slate-200/70 text-slate-600 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-300",
  },
}

export function dueTone(alertLevel: DueAlertLevel | null, status: string): DueTone {
  if (status === "closed" || status === "cancelled") return status
  return alertLevel ?? "normal"
}
