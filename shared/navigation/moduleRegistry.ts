import type { Action, Resource } from "@/lib/permissions"

/** Lucide icon name → resolved in Sidebar via map (client-only icons). */
export const NAV_ICON_KEYS = [
  "LayoutDashboard",
  "Wrench",
  "Factory",
  "ClipboardList",
  "Package",
  "BarChart3",
  "Bell",
  "Settings",
  "Users",
  "Clock",
  "Truck",
  "MapPin",
  "Monitor",
  "CalendarDays",
  "Database",
  "Cpu",
  "Ticket",
  "Fence",
  "ScanLine",
] as const

export type NavIconKey = (typeof NAV_ICON_KEYS)[number]

export type NavPermissionGate = { resource: Resource; action: Action }

export type NavLauncherMeta = {
  departmentId?: string
  capabilityId?: string
  badgeKey?: string
  isPrimary?: boolean
  tags?: string[]
  /** ลำดับบนหน้า /apps เท่านั้น (ไม่กระทบ sidebar — ใช้ `order` ของโหนด) */
  launcherOrder?: number
}

/** ลิงก์เดียว — มี href */
export type NavLinkNode = {
  type: "link"
  key: string
  href: string
  label: string
  icon: NavIconKey
  permission: NavPermissionGate
  /** ใช้กับ tenant overrides / palette grouping */
  moduleId: string
  order?: number
  keywords?: string[]
  launcher?: NavLauncherMeta
}

/** กลุ่มเมนูแบบขยายได้ — children เป็น link / group / section ซ้อนได้ (แนะนำไม่เกิน 2–3 ระดับ) */
export type NavGroupNode = {
  type: "group"
  key: string
  label: string
  icon: NavIconKey
  permission: NavPermissionGate
  moduleId: string
  order?: number
  keywords?: string[]
  launcher?: NavLauncherMeta
  children: ModuleNavNode[]
}

/** หัวข้อแบ่งกลุ่ม (ไม่มีสิทธิ์ของตัวเอง — แสดงเมื่อมี child อย่างน้อยหนึ่งรายการหลังกรอง) */
export type NavSectionNode = {
  type: "section"
  key: string
  label: string
  order?: number
  children: ModuleNavNode[]
}

export type ModuleNavNode = NavLinkNode | NavGroupNode | NavSectionNode

/** @deprecated ใช้ ModuleNavNode — เก็บ alias เพื่อ import เก่า */
export type ModuleNavEntry = ModuleNavNode
export type ModuleNavChild = NavLinkNode

/**
 * แหล่งความจริงเดียวของเมนู dashboard — `href` ต้องตรงกับ App Router
 * และ `launcher` metadata ใช้กับ /apps launcher
 */
export const MODULE_NAV_REGISTRY: ModuleNavNode[] = [
  {
    type: "section",
    key: "sec_overview",
    label: "ภาพรวม",
    order: 0,
    children: [
      {
        type: "link",
        key: "machines",
        href: "/machines",
        label: "เครื่องจักร",
        icon: "Wrench",
        permission: { resource: "machines", action: "read" },
        moduleId: "machines",
        order: 1,
        keywords: ["machines", "เครื่องจักร", "machine", "asset"],
        launcher: { departmentId: "asset_management", capabilityId: "machines", isPrimary: true },
      },
    ],
  },
  {
    type: "section",
    key: "sec_operations",
    label: "การดำเนินงาน",
    order: 10,
    children: [
      {
        type: "group",
        key: "maintenance",
        label: "การซ่อมบำรุง",
        icon: "Factory",
        permission: { resource: "maintenance_plans", action: "read" },
        moduleId: "maintenance",
        order: 0,
        keywords: [
          "maintenance",
          "ซ่อมบำรุง",
          "PM",
          "แผน",
          "ตาราง",
          "ปฏิทิน",
          "dashboard",
          "แดชบอร์ด",
          "รายงาน",
          "reports",
        ],
        launcher: { departmentId: "work_management", capabilityId: "pm", isPrimary: true },
        children: [
          {
            type: "link",
            key: "dashboard",
            href: "/",
            label: "Dashboard",
            icon: "LayoutDashboard",
            permission: { resource: "dashboard", action: "read" },
            moduleId: "dashboard",
            order: 0,
            keywords: ["dashboard", "แดชบอร์ด", "หน้าแรก", "KPI", "ภาพรวมซ่อมบำรุง"],
            launcher: {
              departmentId: "work_management",
              capabilityId: "dashboard",
              /** ไม่ตั้ง isPrimary — มิฉะนั้น /apps จะเรียง primary ก่อนทั้งหมด ทำให้ Dashboard โผล่หน้าแจ้งเตือน */
              launcherOrder: 4,
            },
          },
          {
            type: "link",
            key: "maintenance_plans",
            href: "/maintenance/plans",
            label: "แผนซ่อมบำรุง",
            icon: "Factory",
            permission: { resource: "maintenance_plans", action: "read" },
            moduleId: "maintenance",
            order: 1,
            keywords: ["แผน", "plans", "maintenance plan"],
          },
          {
            type: "link",
            key: "maintenance_schedules",
            href: "/maintenance/schedules",
            label: "ตารางงาน",
            icon: "Factory",
            permission: { resource: "schedules", action: "read" },
            moduleId: "maintenance",
            order: 2,
            keywords: ["ตาราง", "schedule", "งาน"],
          },
          {
            type: "link",
            key: "maintenance_calendar",
            href: "/maintenance/calendar",
            label: "ปฏิทิน",
            icon: "Factory",
            permission: { resource: "schedules", action: "read" },
            moduleId: "maintenance",
            order: 3,
            keywords: ["ปฏิทิน", "calendar"],
          },
          {
            type: "link",
            key: "reports",
            href: "/reports",
            label: "รายงาน",
            icon: "BarChart3",
            permission: { resource: "reports", action: "read" },
            moduleId: "reports",
            order: 4,
            keywords: ["reports", "รายงาน", "analytics", "ซ่อมบำรุง"],
            launcher: { departmentId: "work_management", capabilityId: "reports", launcherOrder: 5 },
          },
        ],
      },
      {
        type: "link",
        key: "work_orders",
        href: "/work-orders",
        label: "ใบสั่งงาน",
        icon: "ClipboardList",
        permission: { resource: "work_orders", action: "read" },
        moduleId: "work_orders",
        order: 1,
        keywords: ["work order", "WO", "ใบสั่งงาน", "งาน"],
        launcher: { departmentId: "work_management", capabilityId: "work_orders", isPrimary: true },
      },
      {
        type: "link",
        key: "spare_parts",
        href: "/spare-parts",
        label: "อะไหล่",
        icon: "Package",
        permission: { resource: "spare_parts", action: "read" },
        moduleId: "spare_parts",
        order: 2,
        keywords: ["spare", "อะไหล่", "inventory", "stock", "parts"],
        launcher: { departmentId: "inventory", capabilityId: "spare_parts", isPrimary: true },
      },
      {
        type: "link",
        key: "notifications",
        href: "/notifications",
        label: "การแจ้งเตือน",
        icon: "Bell",
        permission: { resource: "notifications", action: "read" },
        moduleId: "notifications",
        order: 3,
        keywords: ["notifications", "แจ้งเตือน", "alert", "bell"],
        launcher: { departmentId: "work_management", capabilityId: "notifications", badgeKey: "notifications.unread" },
      },
    ],
  },
  {
    type: "section",
    key: "sec_people",
    label: "บุคลากร",
    order: 15,
    children: [
      {
        type: "link",
        key: "hr_personnel",
        href: "/hr/personnel",
        label: "ข้อมูลบุคลากร",
        icon: "Users",
        permission: { resource: "hr_personnel", action: "read" },
        moduleId: "hr_personnel",
        order: 0,
        keywords: ["HR", "personnel", "พนักงาน", "บุคลากร", "รายชื่อ"],
        launcher: { departmentId: "people", capabilityId: "personnel", isPrimary: true },
      },
      {
        type: "link",
        key: "hr_attendance",
        href: "/hr/attendance",
        label: "บันทึกเวลา",
        icon: "Clock",
        permission: { resource: "hr_attendance", action: "read" },
        moduleId: "hr_attendance",
        order: 1,
        keywords: ["attendance", "time", "เวลา", "เข้างาน", "ออกงาน", "นำเข้า", "Excel"],
        launcher: { departmentId: "people", capabilityId: "attendance", isPrimary: true },
      },
    ],
  },
  {
    type: "section",
    key: "sec_transport",
    label: "ขนส่ง",
    order: 12,
    children: [
      {
        type: "link",
        key: "transport_dashboard",
        href: "/transport",
        label: "ภาพรวมขนส่ง",
        icon: "Truck",
        permission: { resource: "transport_jobs", action: "read" },
        moduleId: "transport_dashboard",
        order: 0,
        keywords: ["transport", "ขนส่ง", "TMS", "dashboard", "ภาพรวม"],
        launcher: { departmentId: "transport", isPrimary: true },
      },
      {
        type: "link",
        key: "transport_jobs",
        href: "/transport/jobs",
        label: "ใบงานขนส่ง",
        icon: "ClipboardList",
        permission: { resource: "transport_jobs", action: "read" },
        moduleId: "transport_jobs",
        order: 1,
        keywords: ["transport job", "ใบงาน", "งานขนส่ง", "delivery"],
        launcher: { departmentId: "transport", isPrimary: true },
      },
      {
        type: "link",
        key: "transport_calendar",
        href: "/transport/calendar",
        label: "ปฏิทินใบงาน",
        icon: "CalendarDays",
        permission: { resource: "transport_jobs", action: "read" },
        moduleId: "transport_calendar",
        order: 2,
        keywords: ["calendar", "ปฏิทิน", "แผน", "schedule", "gantt", "แผนการวิ่ง"],
        launcher: { departmentId: "transport" },
      },
      {
        type: "link",
        key: "transport_map",
        href: "/transport/map",
        label: "แผนที่รถ",
        icon: "MapPin",
        permission: { resource: "transport_vehicles", action: "read" },
        moduleId: "transport_map",
        order: 3,
        keywords: ["map", "แผนที่", "GPS", "location", "ตำแหน่ง"],
        launcher: { departmentId: "transport", isPrimary: true },
      },
      {
        type: "link",
        key: "transport_monitor",
        href: "/transport/monitor",
        label: "มอนิเตอร์รถ",
        icon: "Monitor",
        permission: { resource: "transport_vehicles", action: "read" },
        moduleId: "transport_monitor",
        order: 4,
        keywords: ["monitor", "มอนิเตอร์", "real-time", "สถานะ", "fleet"],
        launcher: { departmentId: "transport" },
      },
      {
        type: "link",
        key: "transport_master_data",
        href: "/transport/master-data",
        label: "ข้อมูลพื้นฐาน",
        icon: "Database",
        permission: { resource: "transport_jobs", action: "read" },
        moduleId: "transport_master_data",
        order: 5,
        keywords: ["master data", "ข้อมูลพื้นฐาน", "ลูกค้า", "ประเภทงาน", "รถ", "คนขับ", "fleet"],
        launcher: { departmentId: "transport" },
      },
    ],
  },
  {
    type: "group",
    key: "iot_control",
    label: "ควบคุม IoT",
    icon: "Cpu",
    permission: { resource: "iot_devices", action: "read" },
    moduleId: "iot_control",
    order: 90,
    keywords: ["iot", "ควบคุม", "อุปกรณ์", "device", "control", "hardware", "esp32"],
    launcher: { departmentId: "iot_control", isPrimary: true },
    children: [
      {
        type: "link",
        key: "iot_queue_ticket",
        href: "http://192.168.1.10:3999/counter",
        label: "ระบบบัตรคิว",
        icon: "Ticket",
        permission: { resource: "iot_devices", action: "read" },
        moduleId: "iot_queue_ticket",
        order: 0,
        keywords: ["บัตรคิว", "queue", "ticket", "counter", "คิว"],
      },
      {
        type: "link",
        key: "iot_barrier_gate",
        href: "http://maikan.local/",
        label: "ระบบไม้กั้น",
        icon: "Fence",
        permission: { resource: "iot_devices", action: "read" },
        moduleId: "iot_barrier_gate",
        order: 1,
        keywords: ["ไม้กั้น", "barrier", "gate", "maikan"],
      },
      {
        type: "link",
        key: "iot_metal_detector",
        href: "http://esp32-gate.local",
        label: "ประตูสแกนโลหะ",
        icon: "ScanLine",
        permission: { resource: "iot_devices", action: "read" },
        moduleId: "iot_metal_detector",
        order: 2,
        keywords: ["สแกนโลหะ", "metal detector", "gate", "esp32", "ประตู"],
      },
    ],
  },
  {
    type: "group",
    key: "settings",
    label: "ตั้งค่า",
    icon: "Settings",
    permission: { resource: "settings", action: "read" },
    moduleId: "settings",
    order: 100,
    keywords: ["settings", "ตั้งค่า", "admin"],
    launcher: { departmentId: "configuration", capabilityId: "admin" },
    children: [
      {
        type: "link",
        key: "settings_users",
        href: "/settings/users",
        label: "ผู้ใช้งาน",
        icon: "Settings",
        permission: { resource: "users", action: "read" },
        moduleId: "settings",
        keywords: ["users", "ผู้ใช้", "accounts"],
      },
      {
        type: "link",
        key: "settings_branches",
        href: "/settings/branches",
        label: "สาขา",
        icon: "Settings",
        permission: { resource: "branches", action: "read" },
        moduleId: "settings",
        keywords: ["branches", "สาขา"],
      },
      {
        type: "link",
        key: "settings_roles",
        href: "/settings/roles",
        label: "สิทธิ์การใช้งาน",
        icon: "Settings",
        permission: { resource: "roles", action: "read" },
        moduleId: "settings",
        keywords: ["roles", "สิทธิ์", "RBAC"],
      },
      {
        type: "link",
        key: "settings_master_data",
        href: "/settings/master-data",
        label: "ข้อมูลพื้นฐาน",
        icon: "Settings",
        permission: { resource: "settings", action: "read" },
        moduleId: "settings",
        keywords: ["master data", "ข้อมูลพื้นฐาน", "categories"],
      },
    ],
  },
]
