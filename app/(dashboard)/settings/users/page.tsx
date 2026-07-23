import { Metadata } from "next"
import { Users, Plus, Search, CheckCircle2, XCircle } from "lucide-react"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"

export const metadata: Metadata = { title: "จัดการผู้ใช้งาน" }

async function getUsers(companyId: string, search?: string) {
  return prisma.user.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { employeeCode: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    select: {
      id: true,
      employeeCode: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      userBranchRoles: {
        include: {
          branch: { select: { name: true } },
          role: { select: { name: true } },
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { firstName: "asc" }],
  })
}

export default async function UsersPage(
  props: {
    searchParams: Promise<{ search?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const session = await auth()
  const users = await getUsers(session!.user.companyId as string, searchParams.search)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ผู้ใช้งาน</h1>
          <p className="text-slate-500 text-sm mt-1">ทั้งหมด {users.length} บัญชี</p>
        </div>
        <Link
          href="/settings/users/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          เพิ่มผู้ใช้งาน
        </Link>
      </div>

      <Card padding="sm">
        <form className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              name="search"
              defaultValue={searchParams.search}
              placeholder="ค้นหาชื่อ, อีเมล, รหัสพนักงาน..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-800 transition-colors">
            ค้นหา
          </button>
          {searchParams.search && (
            <Link href="/settings/users" className="px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50">
              ล้าง
            </Link>
          )}
        </form>
      </Card>

      <Card padding="none">
        {users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="ยังไม่มีผู้ใช้งาน"
            description="เพิ่มผู้ใช้งานคนแรกในระบบ"
            action={
              <Link href="/settings/users/new" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg">
                <Plus className="w-4 h-4" /> เพิ่มผู้ใช้งาน
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">ผู้ใช้งาน</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">อีเมล</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">สาขา / Role</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">เข้าสู่ระบบล่าสุด</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">สถานะ</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user: Awaited<ReturnType<typeof getUsers>>[number]) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-blue-700 text-xs font-bold">
                            {user.firstName[0]}{user.lastName[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{user.firstName} {user.lastName}</p>
                          <p className="text-slate-400 text-xs mt-0.5">{user.employeeCode ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{user.email}</td>
                    <td className="px-5 py-3.5">
                      {user.userBranchRoles.length === 0 ? (
                        <span className="text-slate-400 text-xs">ไม่มี Role</span>
                      ) : (
                        <div className="space-y-1">
                          {user.userBranchRoles.map((ubr: typeof user.userBranchRoles[number], i: number) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <Badge variant={ubr.role.name === "Admin" ? "danger" : ubr.role.name === "Manager" ? "info" : "default"}>
                                {ubr.role.name}
                              </Badge>
                              <span className="text-xs text-slate-400">{ubr.branch.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">
                      {user.lastLoginAt ? formatDate(user.lastLoginAt) : "ยังไม่เคยเข้าสู่ระบบ"}
                    </td>
                    <td className="px-5 py-3.5">
                      {user.isActive ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> ใช้งาน
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400 text-xs font-medium">
                          <XCircle className="w-3.5 h-3.5" /> ปิดการใช้งาน
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link href={`/settings/users/${user.id}/edit`} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                        แก้ไข →
                      </Link>
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
