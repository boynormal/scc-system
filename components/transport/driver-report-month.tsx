"use client"

import { useRouter } from "next/navigation"
import { FinanceMonthPicker } from "@/components/finance/finance-month-picker"

type Props = {
  month: string
  label: string
}

/** One month at a time. The hidden field keeps the month when the branch filter is submitted. */
export function DriverReportMonth({ month, label }: Props) {
  const router = useRouter()

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-foreground">{label}</span>
      <input type="hidden" name="month" value={month} />
      <FinanceMonthPicker
        month={month}
        onChange={(next) => {
          const params = new URLSearchParams(window.location.search)
          params.set("month", next)
          params.delete("from")
          params.delete("to")
          router.push(`/transport/reports?${params.toString()}`)
        }}
      />
    </div>
  )
}
