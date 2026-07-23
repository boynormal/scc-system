import { Badge } from "@/components/ui/badge"
import type { MachineStatus } from "@prisma/client"

const statusConfig: Record<MachineStatus, { label: string; variant: "success" | "warning" | "danger" | "info" | "default" }> = {
  active: { label: "ใช้งาน", variant: "success" },
  inactive: { label: "ไม่ใช้งาน", variant: "default" },
  under_maintenance: { label: "กำลังซ่อม", variant: "warning" },
  decommissioned: { label: "ปลดระวาง", variant: "danger" },
}

export function MachineStatusBadge({ status }: { status: MachineStatus }) {
  const cfg = statusConfig[status]
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}
