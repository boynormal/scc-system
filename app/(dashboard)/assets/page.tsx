import { Suspense } from "react"
import Link from "next/link"
import { ClipboardList } from "lucide-react"
import { auth } from "@/lib/auth"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { APPEARANCE_COOKIE, resolveAppearance } from "@/shared/appearance"
import { prisma } from "@/shared/db"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { listAccessibleBranches, listAssetRegisterTypes, listAssets, listAssetPmBoard, listAssetPmMonth } from "@/modules/assets"
import { bangkokDateKey } from "@/modules/assets/application/asset-pm-service"
import { AssetCreateButton } from "@/components/assets/asset-create-button"
import { AssetTypesButton } from "@/components/assets/asset-types-button"
import { AssetFilters } from "@/components/assets/asset-filters"
import { AssetRowActions } from "@/components/assets/asset-row-actions"
import { EmptyState } from "@/components/ui/empty-state"
import { GlassCard } from "@/components/glass"
import { DataPanel } from "@/components/shell/data-panel"
import { ListPagination, SSR_PAGE_SIZE, parsePage } from "@/components/ui/list-pagination"
import { ModuleBackdrop } from "@/components/shell/module-backdrop"
import { ModuleTabs } from "@/components/shell/module-tabs"
import { PmCheckBoard } from "@/components/assets/pm-check-board"
import { PmMonthGrid } from "@/components/assets/pm-month-grid"

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
    tab?: string
    year?: string
    month?: string
  }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  const t = await getTranslations("assets")
  const pm = await getTranslations("pmCheck")
  const searchParams = await props.searchParams
  const tab =
    searchParams.tab === "pm-check" ? "pm-check" : searchParams.tab === "pm-calendar" ? "pm-calendar" : "register"
  const page = parsePage(searchParams.page)
  const roles = session.user.roles as UserRole[]
  const companyId = session.user.companyId as string

  const tabItems = [
    { key: "register", label: t("title"), href: "/assets" },
    { key: "pm-check", label: pm("title"), href: "/assets?tab=pm-check" },
    { key: "pm-calendar", label: pm("calendarTab"), href: "/assets?tab=pm-calendar" },
  ]
  const cookieStore = await cookies()
  const isDark = resolveAppearance(cookieStore.get(APPEARANCE_COOKIE)?.value) === "dark"
  const tabs = <ModuleTabs items={tabItems} activeKey={tab} aria-label="สินทรัพย์" />

  if (tab === "pm-check") {
    const canUpdatePm =
      isAdminInAnyBranch(roles) ||
      getBranchIds(roles).some((bid) => hasPermission(roles, bid, "assets", "update"))
    const board = await listAssetPmBoard(prisma, { companyId, roles, page })
    return (
      <ModuleBackdrop isDark={isDark}>
        <div className="space-y-6">
          {tabs}
          <div>
            <h1 className="text-2xl font-bold text-foreground">{pm("title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{pm("desc")}</p>
          </div>
          <PmCheckBoard
            rows={board.data}
            summary={board.summary}
            page={board.page}
            total={board.total}
            pageSize={board.pageSize}
            canUpdate={canUpdatePm}
          />
        </div>
      </ModuleBackdrop>
    )
  }

  if (tab === "pm-calendar") {
    const todayKey = bangkokDateKey(new Date())
    const year = Number(searchParams.year) || Number(todayKey.slice(0, 4))
    const month = Number(searchParams.month) || Number(todayKey.slice(5, 7))
    const calendar = await listAssetPmMonth(prisma, { companyId, roles, year, month })
    const prev = new Date(year, month - 2, 1)
    const next = new Date(year, month, 1)
    const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("th-TH", {
      month: "long",
      year: "numeric",
    })
    const href = (date: Date) =>
      `/assets?tab=pm-calendar&year=${date.getFullYear()}&month=${date.getMonth() + 1}`

    return (
      <ModuleBackdrop isDark={isDark}>
        <div className="space-y-6">
          {tabs}
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
            <Link
              href={href(prev)}
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900"
            >
              {pm("prevMonth")}
            </Link>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">{pm("calendarTitle")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{monthLabel}</p>
            </div>
            <Link
              href={href(next)}
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900"
            >
              {pm("nextMonth")}
            </Link>
          </div>
          {calendar.rows.length === 0 ? (
            <EmptyState icon={ClipboardList} title={pm("calendarEmpty")} />
          ) : (
            <PmMonthGrid
              rows={calendar.rows}
              year={calendar.year}
              month={calendar.month}
              daysInMonth={calendar.daysInMonth}
              todayKey={todayKey}
            />
          )}
        </div>
      </ModuleBackdrop>
    )
  }

  const [{ data, total }, branches, types] = await Promise.all([
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
    listAssetRegisterTypes(prisma, { companyId, roles }),
  ])

  const canCreate =
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "assets", "create"))
  const canUpdate =
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "assets", "update"))
  const canDelete =
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "assets", "delete"))
  const totalPages = Math.max(1, Math.ceil(total / SSR_PAGE_SIZE))
  const paginationQuery = {
    search: searchParams.search,
    type: searchParams.type,
    status: searchParams.status,
    ownership: searchParams.ownership,
    branchId: searchParams.branchId,
  }

  return (
    <ModuleBackdrop isDark={isDark}>
    <div className="space-y-6">
      {tabs}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("desc")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canUpdate && <AssetTypesButton />}
          {canCreate && <AssetCreateButton />}
        </div>
      </div>

      <GlassCard padding="sm">
        <Suspense fallback={<div className="h-10 w-full animate-pulse rounded-lg bg-muted" />}>
          <AssetFilters branches={branches.data} types={types.data} />
        </Suspense>
      </GlassCard>

      <DataPanel>
        {data.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={t("empty")}
            description={t("emptyHint")}
            action={
              canCreate ? (
                <AssetCreateButton className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white" />
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
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("manage")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.map((asset) => (
                    <tr key={asset.id} className="transition-colors hover:bg-muted/60">
                      <td className="px-5 py-3.5 font-semibold text-foreground">{asset.code}</td>
                      <td className="px-5 py-3.5 text-foreground">{asset.name}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{asset.typeName}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{t(`own_${asset.ownership}`)}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{asset.branchName}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{t(`st_${asset.status}`)}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{asset.serialNumber ?? "—"}</td>
                      <td className="px-5 py-3.5">
                        <AssetRowActions asset={asset} canUpdate={canUpdate} canDelete={canDelete} />
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
      </DataPanel>
    </div>
    </ModuleBackdrop>
  )
}
