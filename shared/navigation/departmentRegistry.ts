import type { NavIconKey } from "./moduleRegistry"

export type DepartmentDef = {
  id: string
  label: string
  order: number
  icon: NavIconKey
  description?: string
}

export const DEPARTMENT_REGISTRY: DepartmentDef[] = [
  {
    id: "asset_management",
    label: "Asset Management",
    order: 10,
    icon: "Wrench",
    description: "Machines, tools, equipment hierarchy",
  },
  {
    id: "work_management",
    label: "Work Management",
    order: 20,
    icon: "ClipboardList",
    description: "Work orders, notifications, PM scheduling",
  },
  {
    id: "people",
    label: "People & Time",
    order: 25,
    icon: "Users",
    description: "Personnel, daily attendance, Excel import",
  },
  {
    id: "inventory",
    label: "Inventory",
    order: 30,
    icon: "Package",
    description: "Spare parts, stock movement, suppliers",
  },
  {
    id: "transport",
    label: "Transportation",
    order: 35,
    icon: "Truck",
    description: "Vehicle, Driver, Transport Jobs",
  },
  {
    id: "analysis",
    label: "Analysis",
    order: 40,
    icon: "BarChart3",
    description: "Reports, KPI dashboard, analytics",
  },
  {
    id: "configuration",
    label: "Configuration",
    order: 50,
    icon: "Settings",
    description: "Settings, admin, user roles",
  },
]

export const DEPARTMENT_BY_ID: Record<string, DepartmentDef> = Object.fromEntries(
  DEPARTMENT_REGISTRY.map((d) => [d.id, d])
)
