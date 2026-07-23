import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import type { UserRole } from "@/lib/permissions"
import { isAdminInAnyBranch, hasPermission, getBranchIds } from "@/lib/permissions"

function canRead(roles: UserRole[], resource: "transport_jobs" | "transport_vehicles" | "transport_drivers") {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, resource, "read"))
  )
}

export default async function TransportLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  const roles = session.user.roles as UserRole[]
  const hasAnyAccess = canRead(roles, "transport_jobs") || canRead(roles, "transport_vehicles") || canRead(roles, "transport_drivers")
  if (!hasAnyAccess) redirect("/")

  const tabs = [
    canRead(roles, "transport_jobs") && { href: "/transport", label: "ภาพรวม", exact: true },
    canRead(roles, "transport_jobs") && { href: "/transport/jobs", label: "ใบงานขนส่ง", exact: false },
    hasAnyAccess && { href: "/transport/master-data", label: "ข้อมูลพื้นฐาน", exact: false },
    canRead(roles, "transport_vehicles") && { href: "/transport/map", label: "แผนที่", exact: false },
    canRead(roles, "transport_vehicles") && { href: "/transport/monitor", label: "มอนิเตอร์", exact: false },
    canRead(roles, "transport_jobs") && { href: "/transport/calendar", label: "ปฏิทิน", exact: false },
  ].filter(Boolean) as { href: string; label: string; exact: boolean }[]

  return (
    <div>
      <TransportModuleTabs tabs={tabs} />
      {children}
    </div>
  )
}

function TransportModuleTabs({ tabs }: { tabs: { href: string; label: string; exact: boolean }[] }) {
  return (
    <div className="border-b border-slate-200 bg-white px-4 md:px-6">
      <nav className="-mb-px flex gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <TransportTab key={tab.href} href={tab.href} label={tab.label} />
        ))}
      </nav>
    </div>
  )
}

function TransportTab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 aria-[current=page]:border-cyan-600 aria-[current=page]:text-cyan-700"
    >
      {label}
    </Link>
  )
}
