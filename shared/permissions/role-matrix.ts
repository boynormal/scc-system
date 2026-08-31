import type { Action, Permission, Resource } from "@/lib/permissions"
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions"

export type StoredPermission = Permission & { moduleAccess?: string[] | "all" }

export type MatrixAction = Extract<Action, "create" | "read" | "update" | "delete" | "approve">

export type RoleMatrixRow = {
  resource: Resource
  label: string
  actions: MatrixAction[]
}

export type RoleMatrixGroup = {
  id: string
  label: string
  rows: RoleMatrixRow[]
}

export const MATRIX_ACTIONS: { id: MatrixAction; label: string }[] = [
  { id: "read", label: "อ่าน" },
  { id: "create", label: "สร้าง" },
  { id: "update", label: "แก้ไข" },
  { id: "delete", label: "ลบ" },
  { id: "approve", label: "อนุมัติ" },
]

const CRUD: MatrixAction[] = ["read", "create", "update", "delete"]
const CRUD_APPROVE: MatrixAction[] = ["read", "create", "update", "delete", "approve"]
const READ_UPDATE: MatrixAction[] = ["read", "update"]
const READ_ONLY: MatrixAction[] = ["read"]

/** Single source for Role UI matrix — keep in sync with Resource in lib/permissions */
export const ROLE_MATRIX_GROUPS: RoleMatrixGroup[] = [
  {
    id: "ops",
    label: "การดำเนินงาน",
    rows: [
      { resource: "dashboard", label: "Dashboard", actions: READ_ONLY },
      { resource: "machines", label: "เครื่องจักร", actions: CRUD },
      { resource: "maintenance_plans", label: "แผนซ่อมบำรุง", actions: CRUD },
      { resource: "schedules", label: "ตาราง / ปฏิทินซ่อม", actions: CRUD },
      { resource: "work_orders", label: "ใบสั่งงาน", actions: CRUD_APPROVE },
      { resource: "spare_parts", label: "อะไหล่", actions: CRUD },
      { resource: "inventory", label: "สินค้าคงคลัง", actions: CRUD },
      { resource: "reports", label: "รายงาน", actions: READ_ONLY },
      { resource: "notifications", label: "การแจ้งเตือน", actions: READ_ONLY },
    ],
  },
  {
    id: "hr",
    label: "บุคลากรและเวลา",
    rows: [
      { resource: "hr_personnel", label: "ข้อมูลบุคลากร", actions: CRUD },
      { resource: "hr_attendance", label: "บันทึกเวลา", actions: CRUD },
    ],
  },
  {
    id: "transport",
    label: "ขนส่ง",
    rows: [
      { resource: "transport_jobs", label: "ใบงานขนส่ง", actions: CRUD },
      { resource: "transport_vehicles", label: "รถ", actions: CRUD },
      { resource: "transport_drivers", label: "คนขับ", actions: CRUD },
    ],
  },
  {
    id: "iot",
    label: "IoT",
    rows: [{ resource: "iot_devices", label: "อุปกรณ์ IoT", actions: READ_UPDATE }],
  },
  {
    id: "raw_material_news",
    label: "ข่าวสารวัตถุดิบ",
    rows: [{ resource: "raw_material_news", label: "ข่าวสารวัตถุดิบ", actions: READ_ONLY }],
  },
  {
    id: "due_dates",
    label: "วันครบกำหนด",
    rows: [{ resource: "due_dates", label: "ศูนย์ติดตามวันครบกำหนด", actions: CRUD }],
  },
  {
    id: "assets",
    label: "ทะเบียนสินทรัพย์",
    rows: [{ resource: "assets", label: "ทะเบียนสินทรัพย์", actions: CRUD }],
  },
  {
    id: "finance",
    label: "การเงินและบัญชี",
    rows: [
      { resource: "expenses", label: "ค่าใช้จ่าย", actions: CRUD_APPROVE },
      { resource: "expense_masters", label: "ข้อมูลพื้นฐานการเงิน", actions: CRUD },
    ],
  },
  {
    id: "settings",
    label: "ตั้งค่าและสิทธิ์",
    rows: [
      { resource: "users", label: "ผู้ใช้งาน", actions: CRUD },
      { resource: "roles", label: "สิทธิ์ (Roles)", actions: CRUD },
      { resource: "branches", label: "สาขา", actions: CRUD },
      { resource: "settings", label: "การตั้งค่าทั่วไป", actions: READ_UPDATE },
    ],
  },
]

export const MATRIX_RESOURCES: Resource[] = ROLE_MATRIX_GROUPS.flatMap((g) =>
  g.rows.map((r) => r.resource)
)

export function formKey(resource: Resource, action: MatrixAction): string {
  return `${resource}.${action}`
}

export function emptyMatrixFormState(): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const group of ROLE_MATRIX_GROUPS) {
    for (const row of group.rows) {
      for (const action of row.actions) {
        out[formKey(row.resource, action)] = false
      }
    }
  }
  return out
}

export function allMatrixFormState(enabled: boolean): Record<string, boolean> {
  const out = emptyMatrixFormState()
  for (const key of Object.keys(out)) out[key] = enabled
  return out
}

/** DB StoredPermission → form checkbox map (optionally merge role defaults for system roles) */
export function storedToMatrixForm(
  stored: Record<string, unknown> | null | undefined,
  roleName?: string
): Record<string, boolean> {
  const out = emptyMatrixFormState()
  const defaults = roleName ? DEFAULT_ROLE_PERMISSIONS[roleName] : undefined
  const effective: Record<string, unknown> = { ...(defaults ?? {}) }
  if (stored) {
    for (const [key, value] of Object.entries(stored)) {
      if (key === "moduleAccess") continue
      effective[key] = value
    }
  }

  for (const group of ROLE_MATRIX_GROUPS) {
    for (const row of group.rows) {
      const actions = effective[row.resource]
      if (!Array.isArray(actions)) continue
      for (const action of row.actions) {
        if (actions.includes(action)) out[formKey(row.resource, action)] = true
      }
    }
  }
  return out
}

/**
 * Form checkboxes → StoredPermission.
 * Replaces known matrix resources; preserves unknown/legacy keys from previous when provided.
 * Always strips `moduleAccess` — module visibility is User override only; Role uses CRUD.
 */
export function matrixFormToStored(
  raw: Record<string, boolean> | undefined,
  previous?: Record<string, unknown> | null
): StoredPermission {
  const out: StoredPermission = {}

  if (previous) {
    for (const [key, value] of Object.entries(previous)) {
      if (key === "moduleAccess") continue
      if ((MATRIX_RESOURCES as string[]).includes(key)) continue
      out[key as Resource] = value as Action[]
    }
  }

  for (const group of ROLE_MATRIX_GROUPS) {
    for (const row of group.rows) {
      const enabled: Action[] = []
      for (const action of row.actions) {
        if (raw?.[formKey(row.resource, action)]) enabled.push(action)
      }
      if (enabled.length > 0) out[row.resource] = enabled
      else delete out[row.resource]
    }
  }

  return out
}
