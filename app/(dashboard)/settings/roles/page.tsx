import { Metadata } from "next"
import { ShieldCheck, Plus, Users, Lock } from "lucide-react"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export const metadata: Metadata = { title: "จัดการสิทธิ์" }

const roleColors: Record<string, string> = {
  Admin: "bg-red-100 text-red-700",
  Manager: "bg-purple-100 text-purple-700",
  Technician: "bg-blue-100 text-blue-700",
  Viewer: "bg-slate-100 text-slate-600",
}

async function getRoles(companyId: string) {
  return prisma.role.findMany({
    where: { companyId },
    include: { _count: { select: { userBranchRoles: true } } },
    orderBy: { name: "asc" },
  })
}

export default async function RolesSettingsPage() {
  const session = await auth()
  const roles = await getRoles(session!.user.companyId as string)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">สิทธิ์การใช้งาน (Roles)</h1>
          <p className="text-slate-500 text-sm mt-1">ทั้งหมด {roles.length} Roles</p>
        </div>
        <Link
          href="/settings/roles/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          เพิ่ม Role
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {roles.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">ยังไม่มี Role</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Role", "ผู้ใช้งาน", "ประเภท", ""].map(h => (
                  <th key={h} className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roles.map(role => (
                <tr key={role.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{role.name}</p>
                        {role.isSystem && (
                          <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Lock className="w-3 h-3" /> System Role
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{role._count.userBranchRoles} คน</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${roleColors[role.name] ?? "bg-gray-100 text-gray-600"}`}>
                      {role.name}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {!role.isSystem && (
                      <Link href={`/settings/roles/${role.id}/edit`} className="text-xs text-blue-600 hover:text-blue-800 hover:underline">
                        แก้ไข
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
