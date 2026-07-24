import { redirect } from "next/navigation"

/** เส้นทางเดิม — ย้ายไปรวมกับพื้นหลัง/ธีมที่ "หน้าจอหลัก" แล้ว */
export default function LegacyAppIconsRedirect() {
  redirect("/settings/home-screen")
}
