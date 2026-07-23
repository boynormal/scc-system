/**
 * กลุ่มสินค้าหลักสำหรับหน้า /apps (Odoo-style)
 * แมปจาก departmentId ใน moduleRegistry ไปยัง “4 กลุ่ม” ที่ผู้ใช้เข้าใจง่าย
 */
export type ProductLineDef = {
  id: string
  labelTh: string
  labelEn: string
  description: string
  /** อ้างอิง `departmentRegistry` + `launcher.departmentId` */
  departmentIds: string[]
  order: number
  /** คลาสสำหรับไอคอน/เน้นโทน (Tailwind) */
  accent: string
  iconKey: "Wrench" | "Package" | "BarChart3" | "Settings" | "Users" | "Truck"
}

export const PRODUCT_LINE_REGISTRY: ProductLineDef[] = [
  {
    id: "maintenance_mgmt",
    labelTh: "การจัดการซ่อมบำรุง",
    labelEn: "Maintenance Management",
    description: "แดชบอร์ด · รายงาน · แผน PM · ใบสั่งงาน · เครื่องจักร · แจ้งเตือน",
    departmentIds: ["asset_management", "work_management"],
    order: 1,
    accent: "from-blue-500 to-indigo-600 shadow-blue-500/20",
    iconKey: "Wrench",
  },
  {
    id: "people_time",
    labelTh: "บุคลากรและเวลา",
    labelEn: "People & Time",
    description: "ข้อมูลคน · บันทึกเวลา · นำเข้า Excel",
    departmentIds: ["people"],
    order: 2,
    accent: "from-rose-500 to-orange-600 shadow-rose-500/20",
    iconKey: "Users",
  },
  {
    id: "inventory_spares",
    labelTh: "คลังสินค้าและอะไหล่",
    labelEn: "Inventory & Spare Parts",
    description: "อะไหล่ · สต็อก (ขยายคลัง/คลังสินค้าได้ในอนาคต)",
    departmentIds: ["inventory"],
    order: 3,
    accent: "from-emerald-500 to-teal-600 shadow-emerald-500/20",
    iconKey: "Package",
  },
  {
    id: "transport_ops",
    labelTh: "บริหารงานขนส่ง",
    labelEn: "Transport Management",
    description: "รถ · คนขับ · ใบงานขนส่ง · Multi-stop · รูปภาพหลักฐาน",
    departmentIds: ["transport"],
    order: 5,
    accent: "from-cyan-500 to-blue-600 shadow-cyan-500/20",
    iconKey: "Truck",
  },
  {
    id: "settings_admin",
    labelTh: "ตั้งค่าและผู้ดูแลระบบ",
    labelEn: "Core Platform · Settings & Administration",
    description: "ผู้ใช้ · สาขา · สิทธิ์ · ข้อมูลพื้นฐาน — ชั้น Core Platform ที่ทุกสายงานใช้ร่วมกัน",
    departmentIds: ["configuration"],
    order: 4,
    accent: "from-slate-500 to-slate-700 shadow-slate-500/15",
    iconKey: "Settings",
  },
]

export const PRODUCT_LINE_BY_ID: Record<string, ProductLineDef> = Object.fromEntries(
  PRODUCT_LINE_REGISTRY.map((p) => [p.id, p])
)
