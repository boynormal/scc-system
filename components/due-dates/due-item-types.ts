export type DueAlertLevel = "normal" | "watch" | "approaching" | "urgent" | "expired"

export type DueItemDto = {
  id: string
  branchId: string
  branchName: string
  title: string
  startDate: string
  endDate: string
  daysRemaining: number
  status: string
  alertLevel: DueAlertLevel | null
  ownerUserId: string | null
  ownerName: string | null
  notes: string | null
  createdByName: string
  renewals: {
    id: string
    previousStartDate: string
    previousEndDate: string
    newStartDate: string
    newEndDate: string
    renewedAt: string
    notes: string | null
    renewedByName: string
  }[]
}

export const ALERT_LEVELS: DueAlertLevel[] = [
  "normal",
  "watch",
  "approaching",
  "urgent",
  "expired",
]
