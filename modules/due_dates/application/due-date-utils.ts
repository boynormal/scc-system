import { ValidationError } from "@/lib/errors"

export const DUE_ALERT_LEVELS = ["normal", "watch", "approaching", "urgent", "expired"] as const
export type DueAlertLevel = (typeof DUE_ALERT_LEVELS)[number]

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function daysRemaining(endDate: Date | string, today: Date = new Date()): number {
  const end = startOfDay(new Date(endDate))
  const now = startOfDay(today)
  return Math.round((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function getDueAlertLevel(endDate: Date | string, today: Date = new Date()): DueAlertLevel {
  const days = daysRemaining(endDate, today)
  if (days <= 0) return "expired"
  if (days <= 7) return "urgent"
  if (days <= 30) return "approaching"
  if (days <= 60) return "watch"
  return "normal"
}

export function assertStartBeforeEnd(start: Date, end: Date) {
  if (start.getTime() > end.getTime()) {
    throw new ValidationError("วันเริ่มต้นต้องไม่หลังวันสิ้นสุด")
  }
}
