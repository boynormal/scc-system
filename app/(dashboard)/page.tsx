import { redirect } from "next/navigation"

/** หลังล็อกอิน / ชี้ไปหน้า launcher หลัก */
export default function DashboardRootRedirect() {
  redirect("/apps")
}
