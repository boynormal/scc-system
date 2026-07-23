import type {
  Company,
  Branch,
  Department,
  User,
  Role,
  MachineCategory,
  Machine,
  MaintenanceType,
  MaintenancePlan,
  MaintenanceSchedule,
  WorkOrder,
  SparePart,
  SparePartInventory,
} from "@prisma/client"

// ─── Re-exports ───────────────────────────────────────────────────────────────
export type {
  Company,
  Branch,
  Department,
  User,
  Role,
  MachineCategory,
  Machine,
  MaintenanceType,
  MaintenancePlan,
  MaintenanceSchedule,
  WorkOrder,
  SparePart,
  SparePartInventory,
}

// ─── Extended Types with Relations ────────────────────────────────────────────
export type MachineWithRelations = Machine & {
  branch: Branch
  department: Department | null
  category: MachineCategory
  _count?: {
    maintenancePlans: number
    workOrders: number
  }
}

export type WorkOrderWithRelations = WorkOrder & {
  machine: Machine & { branch: Branch }
  type: MaintenanceType
  assignee: Pick<User, "id" | "firstName" | "lastName" | "avatarUrl"> | null
  creator: Pick<User, "id" | "firstName" | "lastName"> | null
  _count?: {
    checklistResults: number
    parts: number
  }
}

export type ScheduleWithRelations = MaintenanceSchedule & {
  plan: MaintenancePlan & { type: MaintenanceType }
  machine: Machine & { branch: Branch }
}

export type SparePartWithInventory = SparePart & {
  inventory: SparePartInventory[]
  _count?: { workOrderParts: number }
}

// ─── API Response Types ───────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ─── Filter / Query Types ─────────────────────────────────────────────────────
export interface MachineFilters {
  branchId?: string
  categoryId?: string
  status?: string
  search?: string
}

export interface WorkOrderFilters {
  branchId?: string
  status?: string
  priority?: string
  assignedTo?: string
  typeId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export interface ScheduleFilters {
  branchId?: string
  status?: string
  dateFrom?: string
  dateTo?: string
  machineId?: string
}

// ─── Dashboard KPI Types ──────────────────────────────────────────────────────
export interface DashboardKPIs {
  totalMachines: number
  activeMachines: number
  underMaintenanceMachines: number
  openWorkOrders: number
  overdueSchedules: number
  upcomingSchedules: number
  lowStockParts: number
  totalCostThisMonth: number
  pmComplianceRate: number
}

export interface ChartDataPoint {
  label: string
  value: number
  color?: string
}
