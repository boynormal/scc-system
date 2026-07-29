import { Metadata } from "next"
import { Building2, Plus, MapPin, Users, Wrench, CheckCircle2, XCircle, Pencil } from "lucide-react"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"


export const metadata: Metadata = { title: "จัดการสาขา" }

async function getBranches(companyId: string) {
  return prisma.branch.findMany({
    where: { companyId, deletedAt: null },
    include: {
      _count: { select: { machines: true, userBranchRoles: true } },
    },
    orderBy: { name: "asc" },
  })
}

export default async function BranchesSettingsPage() {
  const session = await auth()
  const branches = await getBranches(session!.user.companyId as string)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">สาขา</h1>
          <p className="text-muted-foreground text-sm mt-1">
            ทั้งหมด {branches.length} สาขา — สาขาที่ไม่ใช้แล้วให้ปิดใช้งาน
          </p>
        </div>
        <Link
          href="/settings/branches/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          เพิ่มสาขา
        </Link>
      </div>

      {branches.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-border p-12 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">ยังไม่มีสาขา</p>
          <Link href="/settings/branches/new" className="mt-3 inline-flex items-center gap-1.5 text-blue-600 text-sm hover:text-blue-800">
            <Plus className="w-3.5 h-3.5" /> เพิ่มสาขาแรก
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map(branch => (
            <div key={branch.id} className="bg-white dark:bg-slate-800 rounded-xl border border-border shadow-sm p-5 hover:border-blue-200 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${branch.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                    {branch.isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {branch.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                  </span>
                  <Link
                    href={`/settings/branches/${branch.id}/edit`}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="แก้ไขสาขา"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
              <p className="font-semibold text-foreground">{branch.name}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{branch.code}</p>
              {branch.address && (
                <div className="flex items-start gap-1.5 mt-2">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground line-clamp-2">{branch.address}</p>
                </div>
              )}
              <p
                className={`mt-2 text-[11px] font-medium ${
                  branch.latitude != null && branch.longitude != null
                    ? "text-cyan-700"
                    : "text-amber-600"
                }`}
              >
                {branch.latitude != null && branch.longitude != null
                  ? "มีพิกัดอากาศแล้ว"
                  : "ยังไม่มีพิกัดอากาศ"}
              </p>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wrench className="w-3.5 h-3.5" />
                  <span>{branch._count.machines} เครื่อง</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  <span>{branch._count.userBranchRoles} ผู้ใช้</span>
                </div>
                <span className="text-xs text-muted-foreground ml-auto">{branch.timezone}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
