import { Metadata } from "next"
import Link from "next/link"
import { Plus, Search, Users } from "lucide-react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = { title: "บุคลากร" }

function canRead(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_personnel", "read"))
  )
}

function canCreate(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_personnel", "create"))
  )
}

export default async function HrPersonnelPage(props: { searchParams: Promise<{ search?: string }> }) {
  const searchParams = await props.searchParams
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canRead(roles)) redirect("/")

  const companyId = session.user.companyId
  const search = searchParams.search?.trim()

  const list = await prisma.personnel.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(search && {
        OR: [
          { displayName: { contains: search, mode: "insensitive" } },
          { rosterNo: { contains: search, mode: "insensitive" } },
          { jobGroup: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      branch: { select: { name: true, code: true } },
      branchAssignments: {
        include: { branch: { select: { name: true, code: true } } },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
    },
    orderBy: [{ displayName: "asc" }],
    take: 200,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">บุคลากร</h1>
          <p className="text-slate-500 text-sm mt-1">
            ข้อมูลคน · รหัสรายชื่อ (roster) ต่อบริษัท · สามารถผูกหลายสาขาเพื่อลงเวลา/นำเข้า Excel ได้หลายที่
          </p>
        </div>
        {canCreate(roles) && (
          <Link
            href="/hr/personnel/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            เพิ่ม
          </Link>
        )}
      </div>

      <Card padding="sm">
        <form className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              name="search"
              defaultValue={search}
              placeholder="ค้นหา ชื่อ, รหัสรายชื่อ, กลุ่มงาน..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-800 transition-colors">
            ค้นหา
          </button>
          {search && (
            <Link
              href="/hr/personnel"
              className="px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50"
            >
              ล้าง
            </Link>
          )}
        </form>
      </Card>

      <Card padding="none">
        {list.length === 0 ? (
          <EmptyState
            icon={Users}
            title="ยังไม่มีข้อมูล"
            description="เพิ่มรายชื่อ หรือนำเข้าไฟล์บันทึกเวลา ระบบจะสร้าง / อัปเดตอัตโนมัติ"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  <th className="p-3 font-medium">รหัสรายชื่อ</th>
                  <th className="p-3 font-medium">ชื่อแสดง</th>
                  <th className="p-3 font-medium">กลุ่มงาน</th>
                  <th className="p-3 font-medium">สาขา</th>
                  <th className="p-3 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="p-3 font-mono text-slate-800">{p.rosterNo}</td>
                    <td className="p-3 text-slate-800">{p.displayName}</td>
                    <td className="p-3 text-slate-600">{p.jobGroup ?? "—"}</td>
                    <td className="p-3 text-slate-600">
                      {p.branchAssignments.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {p.branchAssignments.map((a) => (
                            <Badge
                              key={a.id}
                              className={
                                a.isPrimary
                                  ? "bg-blue-100 text-blue-800 font-medium"
                                  : "bg-slate-100 text-slate-700"
                              }
                            >
                              {a.branch.code}
                              {a.isPrimary ? " · หลัก" : ""}
                            </Badge>
                          ))}
                        </div>
                      ) : p.branch ? (
                        <span>
                          {p.branch.code} — {p.branch.name}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">
                      {p.isActive ? (
                        <Badge className="bg-emerald-100 text-emerald-800">ใช้งาน</Badge>
                      ) : (
                        <Badge variant="outline">ปิด</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
