import {
  LayoutDashboard,
  Wrench,
  ClipboardList,
  Package,
  BarChart3,
  Settings,
  Factory,
  Bell,
  Users,
  Clock,
  Truck,
  MapPin,
  Monitor,
  CalendarDays,
  Database,
  Cpu,
  Ticket,
  Fence,
  ScanLine,
  type LucideIcon,
} from "lucide-react"
import type { NavIconKey } from "@/shared/navigation/moduleRegistry"

/**
 * แหล่งความจริงเดียวสำหรับ resolve NavIconKey -> component ไอคอน
 * ใช้ทั้งกับไอคอนโมดูล (sidebar/apps launcher) และไอคอนหมวดหมู่ (product line) —
 * รวมถึง productLineIconOverrides ที่ตั้งค่าได้ใน /settings/home-screen
 */
export const NAV_ICON_MAP: Record<NavIconKey, LucideIcon> = {
  LayoutDashboard,
  Wrench,
  Factory,
  ClipboardList,
  Package,
  BarChart3,
  Bell,
  Settings,
  Users,
  Clock,
  Truck,
  MapPin,
  Monitor,
  CalendarDays,
  Database,
  Cpu,
  Ticket,
  Fence,
  ScanLine,
}
