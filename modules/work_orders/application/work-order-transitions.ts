export const HOLD_REASONS = [
  "waiting_part",
  "waiting_user",
  "waiting_approval",
  "waiting_machine_stop",
  "waiting_external",
  "other",
] as const

export type HoldReason = (typeof HOLD_REASONS)[number]

export const WORK_ORDER_STATUSES = [
  "draft",
  "open",
  "assigned",
  "in_progress",
  "on_hold",
  "ready_for_handover",
  "handed_over",
  "completed",
  "closed",
  "cancelled",
] as const

export type WorkOrderStatusName = (typeof WORK_ORDER_STATUSES)[number]

export type TransitionRule = {
  to: WorkOrderStatusName
  needsApprove: boolean
  reason: "none" | "hold" | "text"
  needsAssignee?: boolean
}

const RULES: Record<WorkOrderStatusName, TransitionRule[]> = {
  draft: [
    { to: "open", needsApprove: false, reason: "none" },
    { to: "cancelled", needsApprove: true, reason: "text" },
  ],
  open: [
    { to: "assigned", needsApprove: false, reason: "none", needsAssignee: true },
    { to: "cancelled", needsApprove: true, reason: "text" },
  ],
  assigned: [
    { to: "in_progress", needsApprove: false, reason: "none" },
    { to: "cancelled", needsApprove: true, reason: "text" },
  ],
  in_progress: [
    { to: "on_hold", needsApprove: false, reason: "hold" },
    { to: "ready_for_handover", needsApprove: false, reason: "none" },
    { to: "cancelled", needsApprove: true, reason: "text" },
  ],
  on_hold: [
    { to: "in_progress", needsApprove: false, reason: "none" },
    { to: "cancelled", needsApprove: true, reason: "text" },
  ],
  ready_for_handover: [
    { to: "handed_over", needsApprove: false, reason: "none" },
    { to: "in_progress", needsApprove: false, reason: "text" },
    { to: "cancelled", needsApprove: true, reason: "text" },
  ],
  handed_over: [
    { to: "closed", needsApprove: true, reason: "none" },
    { to: "in_progress", needsApprove: false, reason: "text" },
    { to: "cancelled", needsApprove: true, reason: "text" },
  ],
  completed: [],
  closed: [],
  cancelled: [],
}

export const WORK_ORDER_STATUS_LABEL: Record<WorkOrderStatusName, string> = {
  draft: "ร่าง",
  open: "เปิด",
  assigned: "มอบหมายแล้ว",
  in_progress: "กำลังทำ",
  on_hold: "รอ",
  ready_for_handover: "รอส่งมอบ",
  handed_over: "ส่งมอบแล้ว",
  completed: "เสร็จสิ้น (เดิม)",
  closed: "ปิดงาน",
  cancelled: "ยกเลิก",
}

export const HOLD_REASON_LABEL: Record<HoldReason, string> = {
  waiting_part: "รออะไหล่",
  waiting_user: "รอผู้ใช้งาน",
  waiting_approval: "รออนุมัติ",
  waiting_machine_stop: "รอเครื่องหยุด",
  waiting_external: "รอผู้รับจ้างภายนอก",
  other: "อื่น ๆ",
}

export function isWorkOrderStatus(value: string): value is WorkOrderStatusName {
  return (WORK_ORDER_STATUSES as readonly string[]).includes(value)
}

export function isHoldReason(value: string): value is HoldReason {
  return (HOLD_REASONS as readonly string[]).includes(value)
}

export function transitionsFrom(status: string): TransitionRule[] {
  if (!isWorkOrderStatus(status)) return []
  return RULES[status]
}

export function evaluateTransition(input: {
  from: string
  to: string
  reason?: string | null
  hasApprove: boolean
  assignedTo?: string | null
}): { ok: true; rule: TransitionRule } | { ok: false; message: string } {
  if (!isWorkOrderStatus(input.from) || !isWorkOrderStatus(input.to)) {
    return { ok: false, message: "สถานะไม่ถูกต้อง" }
  }
  const rule = RULES[input.from].find((item) => item.to === input.to)
  if (!rule) return { ok: false, message: "เปลี่ยนสถานะนี้ไม่ได้" }
  if (rule.needsApprove && !input.hasApprove) {
    return { ok: false, message: "ต้องมีสิทธิ์อนุมัติ" }
  }
  const reason = input.reason?.trim() ?? ""
  if (rule.reason === "hold" && !isHoldReason(reason)) {
    return { ok: false, message: "ต้องระบุเหตุผลการรอ" }
  }
  if (rule.reason === "text" && reason.length === 0) {
    return { ok: false, message: "ต้องระบุเหตุผล" }
  }
  if (rule.needsAssignee && !input.assignedTo) {
    return { ok: false, message: "ต้องระบุผู้รับผิดชอบ" }
  }
  return { ok: true, rule }
}
