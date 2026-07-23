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
  type LucideIcon,
} from "lucide-react"
import type { NavIconKey } from "@/shared/navigation/moduleRegistry"
import type { ProductLineDef } from "@/shared/navigation/productLineRegistry"

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
}

export const PRODUCT_LINE_ICON_MAP: Record<ProductLineDef["iconKey"], LucideIcon> = {
  Wrench,
  Package,
  BarChart3,
  Settings,
  Users,
  Truck,
}
