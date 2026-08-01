import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { isAdminInAnyBranch, getBranchIds } from "@/lib/permissions"
import Link from "next/link"
import { Truck, Users, ClipboardList, CheckCircle2, Clock, AlertCircle } from "lucide-react"
import { getTranslations } from "next-intl/server"

export async function generateMetadata() {
  const t = await getTranslations("transport")
  return { title: t("overviewTitle") }
}

async function getStats(companyId: string, branchIds: string[]) {
  const where = { companyId, branchId: { in: branchIds } }

  const [
    totalVehicles, availableVehicles, onJobVehicles, maintenanceVehicles,
    totalDrivers, availableDrivers,
    totalJobs, pendingJobs, activeJobs, completedJobs, cancelledJobs,
  ] = await Promise.all([
    prisma.transportVehicle.count({ where: { ...where, isActive: true } }),
    prisma.transportVehicle.count({ where: { ...where, isActive: true, currentStatus: "available" } }),
    prisma.transportVehicle.count({ where: { ...where, isActive: true, currentStatus: "on_job" } }),
    prisma.transportVehicle.count({ where: { ...where, isActive: true, currentStatus: "maintenance" } }),
    prisma.driver.count({ where: { ...where, isActive: true } }),
    prisma.driver.count({ where: { ...where, isActive: true, currentStatus: "available" } }),
    prisma.transportJob.count({ where }),
    prisma.transportJob.count({ where: { ...where, status: "pending_assignment" } }),
    prisma.transportJob.count({
      where: {
        ...where,
        status: { in: ["assigned", "driver_accepted", "en_route", "at_pickup", "loading", "departed", "at_destination", "unloading"] },
      },
    }),
    prisma.transportJob.count({ where: { ...where, status: "completed" } }),
    prisma.transportJob.count({ where: { ...where, status: "cancelled" } }),
  ])

  return {
    vehicles: { total: totalVehicles, available: availableVehicles, onJob: onJobVehicles, maintenance: maintenanceVehicles },
    drivers: { total: totalDrivers, available: availableDrivers },
    jobs: { total: totalJobs, pending: pendingJobs, active: activeJobs, completed: completedJobs, cancelled: cancelledJobs },
  }
}

async function getRecentJobs(companyId: string, branchIds: string[]) {
  return prisma.transportJob.findMany({
    where: { companyId, branchId: { in: branchIds } },
    include: {
      assignment: {
        include: {
          vehicle: { select: { plateNumber: true } },
          driver: { select: { firstName: true, lastName: true } },
        },
      },
      _count: { select: { stops: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  })
}

const JOB_STATUS_LABEL: Record<string, string> = {
  pending_assignment: "รอมอบหมาย",
  assigned: "มอบหมายแล้ว",
  driver_accepted: "คนขับรับงาน",
  en_route: "กำลังเดินทาง",
  at_pickup: "ถึงจุดรับ",
  loading: "กำลังโหลด",
  departed: "ออกเดินทาง",
  at_destination: "ถึงปลายทาง",
  unloading: "กำลังขนถ่าย",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
}

const JOB_STATUS_COLOR: Record<string, string> = {
  pending_assignment: "bg-amber-100 text-amber-800",
  assigned: "bg-blue-100 text-blue-800",
  driver_accepted: "bg-indigo-100 text-indigo-800",
  en_route: "bg-cyan-100 text-cyan-800",
  at_pickup: "bg-teal-100 text-teal-800",
  loading: "bg-teal-100 text-teal-800",
  departed: "bg-sky-100 text-sky-800",
  at_destination: "bg-emerald-100 text-emerald-800",
  unloading: "bg-emerald-100 text-emerald-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-muted text-muted-foreground",
}

export default async function TransportDashboardPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const t = await getTranslations("transport")

  const roles = session.user.roles as UserRole[]
  const companyId = session.user.companyId as string
  const branchIds = isAdminInAnyBranch(roles)
    ? (await prisma.branch.findMany({ where: { companyId, isActive: true }, select: { id: true } })).map((b) => b.id)
    : getBranchIds(roles)

  const [stats, recentJobs] = await Promise.all([
    getStats(companyId, branchIds),
    getRecentJobs(companyId, branchIds),
  ])

  return (
    <div className="min-w-0 space-y-8 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("overviewTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("overviewDesc")}</p>
      </div>

      {/* Vehicle stats */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">ยานพาหนะ</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Truck className="h-5 w-5" />} label="รถทั้งหมด" value={stats.vehicles.total} color="bg-cyan-50 text-cyan-700" />
          <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="พร้อมใช้" value={stats.vehicles.available} color="bg-green-50 text-green-700" />
          <StatCard icon={<Clock className="h-5 w-5" />} label="กำลังใช้งาน" value={stats.vehicles.onJob} color="bg-blue-50 text-blue-700" />
          <StatCard icon={<AlertCircle className="h-5 w-5" />} label="ซ่อมบำรุง" value={stats.vehicles.maintenance} color="bg-amber-50 text-amber-700" />
        </div>
      </section>

      {/* Driver stats */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">คนขับ</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard icon={<Users className="h-5 w-5" />} label="คนขับทั้งหมด" value={stats.drivers.total} color="bg-violet-50 text-violet-700" />
          <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="พร้อมรับงาน" value={stats.drivers.available} color="bg-green-50 text-green-700" />
        </div>
      </section>

      {/* Job stats */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">ใบงาน</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<ClipboardList className="h-5 w-5" />} label="ทั้งหมด" value={stats.jobs.total} color="bg-muted text-foreground" />
          <StatCard icon={<Clock className="h-5 w-5" />} label="รอมอบหมาย" value={stats.jobs.pending} color="bg-amber-50 text-amber-700" />
          <StatCard icon={<Truck className="h-5 w-5" />} label="กำลังดำเนินการ" value={stats.jobs.active} color="bg-blue-50 text-blue-700" />
          <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="เสร็จสิ้น" value={stats.jobs.completed} color="bg-green-50 text-green-700" />
        </div>
      </section>

      {/* Recent jobs */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">ใบงานล่าสุด</h2>
          <Link href="/transport/jobs" className="text-sm font-medium text-cyan-600 hover:text-cyan-700">
            ดูทั้งหมด →
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead className="bg-muted text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">เลขใบงาน</th>
                <th className="px-4 py-3 text-left">ลูกค้า</th>
                <th className="px-4 py-3 text-left">รถ / คนขับ</th>
                <th className="px-4 py-3 text-left">จำนวน Stop</th>
                <th className="px-4 py-3 text-left">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentJobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{t("jobsEmpty")}</td>
                </tr>
              ) : (
                recentJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-muted/60">
                    <td className="px-4 py-3 font-medium text-cyan-700">
                      <Link href={`/transport/jobs/${job.id}`}>{job.jobNumber}</Link>
                    </td>
                    <td className="px-4 py-3 text-foreground">{job.customerName ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {job.assignment ? (
                        <span>
                          {job.assignment.vehicle.plateNumber} /{" "}
                          {job.assignment.driver.firstName} {job.assignment.driver.lastName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">ยังไม่มอบหมาย</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{job._count.stops} จุด</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${JOB_STATUS_COLOR[job.status] ?? "bg-muted text-muted-foreground"}`}>
                        {JOB_STATUS_LABEL[job.status] ?? job.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className={`flex items-center gap-4 rounded-xl border border-white/60 p-4 shadow-sm ${color} bg-opacity-60`}>
      <div className={`rounded-lg p-2 ${color}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs font-medium opacity-75">{label}</p>
      </div>
    </div>
  )
}
