import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateWONumber(sequence: number): string {
  const year = new Date().getFullYear()
  const pad = String(sequence).padStart(5, "0")
  return `WO-${year}-${pad}`
}

export function formatCurrency(amount: number | string, locale = "th-TH", currency = "THB"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(amount))
}

export function formatDate(date: Date | string | null | undefined, locale = "th-TH"): string {
  if (!date) return "-"
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(date))
}

export function formatDateTime(date: Date | string | null | undefined, locale = "th-TH"): string {
  if (!date) return "-"
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(date))
}

export function getDueDateStatus(dueDate: Date | string): "overdue" | "today" | "upcoming" | "future" {
  const due = new Date(dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)

  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return "overdue"
  if (diffDays === 0) return "today"
  if (diffDays <= 7) return "upcoming"
  return "future"
}

export function calculateNextDueDate(
  currentDate: Date,
  frequencyUnit: string,
  frequencyValue: number
): Date {
  const next = new Date(currentDate)
  switch (frequencyUnit) {
    case "day":
      next.setDate(next.getDate() + frequencyValue)
      break
    case "week":
      next.setDate(next.getDate() + frequencyValue * 7)
      break
    case "month":
      next.setMonth(next.getMonth() + frequencyValue)
      break
    case "quarter":
      next.setMonth(next.getMonth() + frequencyValue * 3)
      break
    case "year":
      next.setFullYear(next.getFullYear() + frequencyValue)
      break
    default:
      break
  }
  return next
}
