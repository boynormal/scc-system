import { cookies } from "next/headers"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { UserRole } from "@/lib/permissions"
import { getBranchIds, hasPermission, isAdminInAnyBranch } from "@/lib/permissions"
import { APPEARANCE_COOKIE, resolveAppearance } from "@/shared/appearance"
import { canEnterModuleArea } from "@/shared/permissions/module-access-catalog"
import { ModuleBackdrop } from "@/components/shell/module-backdrop"
import { TransportModuleTabs } from "./transport-module-tabs"

function canRead(roles: UserRole[], resource: "transport_jobs" | "transport_vehicles" | "transport_drivers") {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, resource, "read"))
  )
}

export default async function TransportLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  if (session.user.driverLogin) {
    return <div className="min-w-0">{children}</div>
  }

  const roles = session.user.roles as UserRole[]
  if (!canEnterModuleArea(roles, "transport", session.user.moduleAccess)) redirect("/")

  const tabs = [
    canRead(roles, "transport_jobs") && { href: "/transport", label: "ภาพรวม", exact: true },
    canRead(roles, "transport_jobs") && { href: "/transport/jobs", label: "ใบงานขนส่ง", exact: false },
    canRead(roles, "transport_vehicles") && { href: "/transport/repairs", label: "ใบแจ้งซ่อม", exact: false },
    canRead(roles, "transport_vehicles") && { href: "/transport/tires", label: "จัดการยาง", exact: false },
    (canRead(roles, "transport_jobs") ||
      canRead(roles, "transport_vehicles") ||
      canRead(roles, "transport_drivers")) && {
      href: "/transport/master-data",
      label: "ข้อมูลพื้นฐาน",
      exact: false,
    },
    canRead(roles, "transport_vehicles") && { href: "/transport/map", label: "แผนที่", exact: false },
    canRead(roles, "transport_vehicles") && { href: "/transport/monitor", label: "มอนิเตอร์", exact: false },
    canRead(roles, "transport_jobs") && { href: "/transport/calendar", label: "ปฏิทิน", exact: false },
  ].filter(Boolean) as { href: string; label: string; exact: boolean }[]

  const cookieStore = await cookies()
  const isDark = resolveAppearance(cookieStore.get(APPEARANCE_COOKIE)?.value) === "dark"

  return (
    <ModuleBackdrop isDark={isDark}>
      <div className="space-y-6">
        <TransportModuleTabs tabs={tabs} />
        <div className="min-w-0">{children}</div>
      </div>
    </ModuleBackdrop>
  )
}
