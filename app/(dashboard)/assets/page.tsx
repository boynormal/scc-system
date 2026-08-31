import { Suspense } from "react"
import Link from "next/link"
import { Plus, ClipboardList } from "lucide-react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { prisma } from "@/shared/db"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { listAccessibleBranches, listAssets } from "@/modules/assets"
import { AssetFilters } from "@/components/assets/asset-filters"
import { EmptyState } from "@/components/ui/empty-state"
import { GlassCard } from "@/components/glass"
import { ListPagination, SSR_PAGE_SIZE, parsePage } from "@/components/ui/list-pagination"

export async function generateMetadata() {
  const t = await getTranslations("assets")
  return { title: t("title") }
}

export default async function AssetsListPage(props: {
  searchParams: Promise<{
    search?: string
    type?: string
    status?: string
    ownership?: string
    branchId?: string
    page?: string
  }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  const t = await getTranslations("assets")
  const searchParams = await props.searchParams
  const page = parsePage(searchParams.page)
  const roles = session.user.roles as UserRole[]
  const companyId = session.user.companyId as string

  const [{ data, total }, branches] = await Promise.all([
    listAssets(prisma, {
      companyId,
      roles,
      branchId: searchParams.branchId,
      type: searchParams.type,
      status: searchParams.status,
      ownership: searchParams.ownership,
      search: searchParams.search,
      page,
      pageSize: SSR_PAGE_SIZE,
    }),
    listAccessibleBranches(prisma, { companyId, roles }),
  ])

  const canCreate =
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "assets", "create"))
  const totalPages = Math.max(1, Math.ceil(total / SSR_PAGE_SIZE))
  const paginationQuery = {
    search: searchParams.search,
    type: searchParams.type,
    status: searchParams.status,
    ownership: searchParams.ownership,
    branchId: searchParams.branchId,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("desc")}</p>
        </div>
        {canCreate && (
          <Link
            href="/assets/new"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            {t("newAsset")}
          </Link>
        )}
      </div>

      <GlassCard padding="sm">
        <Suspense fallback={<div className="h-10 w-full animate-pulse rounded-lg bg-muted" />}>
          <AssetFilters branches={branches.data} />
        </Suspense>
      </GlassCard>

      <GlassCard padding="none">
        {data.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={t("empty")}
            description={t("emptyHint")}
            action={
              canCreate ? (
                <Link
                  href="/assets/new"
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                >
                  <Plus className="h-4 w-4" /> {t("newAsset")}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("code")}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("name")}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("type")}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("ownership")}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("branch")}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("status")}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("serialNumber")}
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.map((asset) => (
                    <tr key={asset.id} className="transition-colors hover:bg-muted/60">
                      <td className="px-5 py-3.5 font-semibold text-foreground">{asset.code}</td>
                      <td className="px-5 py-3.5 text-foreground">{asset.name}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{t(`type_${asset.type}`)}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{t(`own_${asset.ownership}`)}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{asset.branchName}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{t(`st_${asset.status}`)}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{asset.serialNumber ?? "—"}</td>
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/assets/${asset.id}`}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          {t("viewDetail")} →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ListPagination
              pathname="/assets"
              page={page}
              totalPages={totalPages}
              total={total}
              query={paginationQuery}
            />
          </>
        )}
      </GlassCard>
    </div>
  )
}
