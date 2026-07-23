import { redirect } from "next/navigation"

/** แดชบอร์ดภาพรวมอยู่ที่หน้ารายงาน — รักษา / เป็นเข้าทางเดิมหลังล็อกอิน */
export default function DashboardRootRedirect() {
  redirect("/reports")
}
