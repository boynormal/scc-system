import type { NavIconKey } from "./moduleRegistry"

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
  /** ไอคอนเริ่มต้น — บริษัทสามารถ override ได้ต่อ line.id ผ่าน companies.settings.nav.productLineIconOverrides */
  iconKey: NavIconKey
}

export const PRODUCT_LINE_REGISTRY: ProductLineDef[] = [
  {
    id: "maintenance_mgmt",
    labelTh: "การจัดการซ่อมบำรุง",
    labelEn: "Maintenance Management",
    description: "เครื่องจักร · แผน PM · ตาราง · ปฏิทิน · ใบสั่งงาน · รายงาน · แจ้งเตือน",
    departmentIds: ["asset_management", "work_management"],
    order: 1,
    accent: "from-blue-500 to-indigo-600 shadow-blue-600/30",

    iconKey: "Wrench",
  },
  {
    id: "people_time",
    labelTh: "บุคลากรและเวลา",
    labelEn: "People & Time",
    description: "ข้อมูลคน · บันทึกเวลา · นำเข้า Excel",
    departmentIds: ["people"],
    order: 2,
    accent: "from-rose-500 to-orange-600 shadow-rose-600/30",
    iconKey: "Users",
  },
  {
    id: "inventory_spares",
    labelTh: "คลังสินค้าและอะไหล่",
    labelEn: "Inventory & Spare Parts",
    description: "อะไหล่ · สต็อก (ขยายคลัง/คลังสินค้าได้ในอนาคต)",
    departmentIds: ["inventory"],
    order: 3,
    accent: "from-emerald-500 to-teal-600 shadow-emerald-600/30",
    iconKey: "Package",
  },
  {
    id: "transport_ops",
    labelTh: "บริหารงานขนส่ง",
    labelEn: "Transport Management",
    description: "รถ · คนขับ · ใบงานขนส่ง · Multi-stop · รูปภาพหลักฐาน",
    departmentIds: ["transport"],
    order: 5,
    accent: "from-cyan-500 to-blue-600 shadow-cyan-600/30",
    iconKey: "Truck",
  },
  {
    id: "iot_control",
    labelTh: "ควบคุม IoT",
    labelEn: "IoT Control",
    description: "ควบคุมบัตรคิว · ออกบัตรคิว · ไม้กั้น · ประตูสแกนโลหะ — ลิงก์ไปหน้าควบคุมอุปกรณ์ IoT บนเครือข่ายไซต์งาน",
    departmentIds: ["iot_control"],
    order: 6,
    accent: "from-fuchsia-500 to-purple-600 shadow-fuchsia-600/30",
    iconKey: "Cpu",
  },
  {
    id: "due_dates",
    labelTh: "ศูนย์ติดตามวันครบกำหนด",
    labelEn: "Due Date Management",
    description: "รายการ · ต่ออายุ · แจ้งเตือน",
    departmentIds: ["due_dates"],
    order: 8,
    accent: "from-violet-500 to-indigo-600 shadow-violet-600/30",
    iconKey: "CalendarDays",
  },
  {
    id: "finance",
    labelTh: "การเงินและบัญชี",
    labelEn: "Finance & Accounting",
    description: "ค่าใช้จ่าย · ต้นทุน · อนุมัติ · รายงาน",
    departmentIds: ["finance"],
    order: 9,
    accent: "from-emerald-500 to-teal-600 shadow-emerald-600/30",
    iconKey: "Wallet",
  },
  {
    id: "raw_material_news",
    labelTh: "ข่าวสารวัตถุดิบ",
    labelEn: "Raw Material News",
    description: "กระดาษ · เหล็ก · โลหะมีค่า · Ewaste",
    departmentIds: ["raw_material_news"],
    order: 7,
    accent: "from-amber-500 to-orange-600 shadow-amber-600/30",
    iconKey: "Newspaper",
  },
  {
    id: "settings_admin",
    labelTh: "ตั้งค่าและผู้ดูแลระบบ",
    labelEn: "Core Platform · Settings & Administration",
    description: "ผู้ใช้ · สาขา · สิทธิ์ · ข้อมูลพื้นฐาน",
    departmentIds: ["configuration"],
    order: 4,
    accent: "from-slate-600 to-slate-800 shadow-slate-700/30",
    iconKey: "Settings",
  },
]

export const PRODUCT_LINE_BY_ID: Record<string, ProductLineDef> = Object.fromEntries(
  PRODUCT_LINE_REGISTRY.map((p) => [p.id, p])
)
