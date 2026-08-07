import { Metadata } from "next"
import { Suspense } from "react"
import { Users, Plus, CheckCircle2, XCircle } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { GlassCard } from "@/components/glass"
import { formatDate } from "@/lib/utils"
import { ListPagination, SSR_PAGE_SIZE, parsePage } from "@/components/ui/list-pagination"
import { UsersListSearch } from "@/components/settings/users-list-search"
import type { Prisma } from "@prisma/client"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings")
  return { title: t("usersTitle") }
}

async function getUsersPage(companyId: string, page: number, search?: string) {
  const where: Prisma.UserWhereInput = {
    companyId,
    deletedAt: null,
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
        { employeeCode: { contains: search, mode: "insensitive" } },
      ],
    }),
  }
  const skip = (page - 1) * SSR_PAGE_SIZE

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
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
      skip,
      take: SSR_PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ])

  return { users, total }
}

export default async function UsersPage(
  props: {
    searchParams: Promise<{ search?: string; page?: string }>
  }
) {
  const searchParams = await props.searchParams
  const page = parsePage(searchParams.page)
  const session = await auth()
  const t = await getTranslations("settings")
  const { users, total } = await getUsersPage(
    session!.user.companyId as string,
    page,
    searchParams.search
  )
  const totalPages = Math.max(1, Math.ceil(total / SSR_PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("usersTitle")}</h1>
          <p className="text-muted-foreground text-sm mt-1">ทั้งหมด {total} บัญชี</p>
        </div>
        <Link
          href="/settings/users/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          เพิ่มผู้ใช้งาน
        </Link>
      </div>

      <GlassCard padding="sm">
        <Suspense fallback={<div className="h-10 max-w-xl animate-pulse rounded-lg bg-muted" />}>
          <UsersListSearch />
        </Suspense>
      </GlassCard>

      <GlassCard padding="none">
        {users.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("usersEmpty")}
            description="เพิ่มผู้ใช้งานคนแรกในระบบ"
            action={
              <Link href="/settings/users/new" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg">
                <Plus className="w-4 h-4" /> เพิ่มผู้ใช้งาน
              </Link>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">ผู้ใช้งาน</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Username</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">อีเมล</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">สาขา / Role</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">เข้าสู่ระบบล่าสุด</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">สถานะ</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-blue-700 text-xs font-bold">
                              {user.firstName[0]}{user.lastName[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{user.firstName} {user.lastName}</p>
                            <p className="text-muted-foreground text-xs mt-0.5">{user.employeeCode ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground font-mono text-xs">{user.username}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{user.email}</td>
                      <td className="px-5 py-3.5">
                        {user.userBranchRoles.length === 0 ? (
                          <span className="text-muted-foreground text-xs">ไม่มี Role</span>
                        ) : (
                          <div className="space-y-1">
                            {user.userBranchRoles.map((ubr, i) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <Badge variant={ubr.role.name === "Admin" ? "danger" : ubr.role.name === "Manager" ? "info" : "default"}>
                                  {ubr.role.name}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{ubr.branch.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs">
                        {user.lastLoginAt ? formatDate(user.lastLoginAt) : "ยังไม่เคยเข้าสู่ระบบ"}
                      </td>
                      <td className="px-5 py-3.5">
                        {user.isActive ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> ใช้งาน
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground text-xs font-medium">
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
            <ListPagination
              pathname="/settings/users"
              page={page}
              totalPages={totalPages}
              total={total}
              query={{ search: searchParams.search }}
            />
          </>
        )}
      </GlassCard>
    </div>
  )
}
