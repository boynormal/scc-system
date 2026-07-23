import type { TransportJobStatus } from "@prisma/client"

export type JobListGroup = "active" | "completed" | "cancelled"

export const JOB_LIST_GROUPS: { id: JobListGroup; label: string }[] = [
  { id: "active", label: "ใบงานใหม่" },
  { id: "completed", label: "ใบงานเสร็จสิ้น" },
  { id: "cancelled", label: "ใบงานยกเลิก" },
]

export const ACTIVE_JOB_STATUSES: TransportJobStatus[] = [
  "pending_assignment",
  "assigned",
  "driver_accepted",
  "en_route",
  "at_pickup",
  "loading",
  "departed",
  "at_destination",
  "unloading",
]

export function resolveJobListGroup(group?: string | null): JobListGroup {
  if (group === "completed" || group === "cancelled") return group
  return "active"
}

export function statusFilterForGroup(
  group: JobListGroup
): { status: TransportJobStatus } | { status: { in: TransportJobStatus[] } } {
  switch (group) {
    case "completed":
      return { status: "completed" }
    case "cancelled":
      return { status: "cancelled" }
    case "active":
      return { status: { in: ACTIVE_JOB_STATUSES } }
  }
}
