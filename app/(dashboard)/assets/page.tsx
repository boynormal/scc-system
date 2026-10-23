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
import { AssetPmToggle } from "@/components/assets/asset-pm-toggle"
import { EmptyState } from "@/components/ui/empty-state"
import { ListPagination, SSR_PAGE_SIZE, parsePage } from "@/components/ui/list-pagination"
import { ModuleBackdrop } from "@/components/shell/module-backdrop"
import { ModuleTabs } from "@/components/shell/module-tabs"
import { PmCheckBoard } from "@/components/assets/pm-check-board"
import { PmCalendarFilters } from "@/components/assets/pm-calendar-filters"
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
    maintenancePm?: string
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
    const [board, branches, types] = await Promise.all([
      listAssetPmBoard(prisma, {
        companyId,
        roles,
        page,
        branchId: searchParams.branchId,
        typeId: searchParams.type,
        search: searchParams.search,
      }),
      listAccessibleBranches(prisma, { companyId, roles }),
      listAssetRegisterTypes(prisma, { companyId, roles, activeOnly: true }),
    ])
    return (
      <ModuleBackdrop isDark={isDark}>
        <div className="relative z-10 space-y-6">
          {tabs}
          <div>
            <h1 className="text-2xl font-bold text-foreground">{pm("title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{pm("desc")}</p>
          </div>
          <Suspense fallback={<div className="h-12 w-full animate-pulse rounded-xl bg-[#e2e8f0]" />}>
            <PmCalendarFilters
              key={`${searchParams.branchId ?? ""}-${searchParams.type ?? ""}-${searchParams.search ?? ""}`}
              tab="pm-check"
              branches={branches.data}
              types={types.data}
              summary={board.summary}
            />
          </Suspense>
          <PmCheckBoard
            rows={board.data}
            page={board.page}
            total={board.total}
            pageSize={board.pageSize}
            canUpdate={canUpdatePm}
            query={{
              tab: "pm-check",
              search: searchParams.search,
              branchId: searchParams.branchId,
              type: searchParams.type,
            }}
          />
        </div>
      </ModuleBackdrop>
    )
  }

  if (tab === "pm-calendar") {
    const todayKey = bangkokDateKey(new Date())
    const year = Number(searchParams.year) || Number(todayKey.slice(0, 4))
    const month = Number(searchParams.month) || Number(todayKey.slice(5, 7))
    const [calendar, branches, types] = await Promise.all([
      listAssetPmMonth(prisma, {
        companyId,
        roles,
        year,
        month,
        branchId: searchParams.branchId,
        typeId: searchParams.type,
        search: searchParams.search,
      }),
      listAccessibleBranches(prisma, { companyId, roles }),
      listAssetRegisterTypes(prisma, { companyId, roles, activeOnly: true }),
    ])
    const prev = new Date(year, month - 2, 1)
    const next = new Date(year, month, 1)
    const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("th-TH", {
      month: "long",
      year: "numeric",
    })
    const href = (date: Date) => {
      const params = new URLSearchParams({
        tab: "pm-calendar",
        year: String(date.getFullYear()),
        month: String(date.getMonth() + 1),
      })
      if (searchParams.search) params.set("search", searchParams.search)
      if (searchParams.branchId) params.set("branchId", searchParams.branchId)
      if (searchParams.type) params.set("type", searchParams.type)
      return `/assets?${params.toString()}`
    }

    return (
      <ModuleBackdrop isDark={isDark}>
        <div className="relative z-10 space-y-6">
          {tabs}
          <Suspense fallback={<div className="h-12 w-full animate-pulse rounded-xl bg-[#e2e8f0]" />}>
            <PmCalendarFilters
              key={`${searchParams.branchId ?? ""}-${searchParams.type ?? ""}-${searchParams.search ?? ""}`}
              nowrap
              branches={branches.data}
              types={types.data}
              year={calendar.year}
              month={calendar.month}
              trailing={
                <div className="flex w-full items-center justify-between gap-2 lg:w-auto lg:justify-start lg:gap-3">
                  <Link
                    href={href(prev)}
                    className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900"
                  >
                    {pm("prevMonth")}
                  </Link>
                  <div className="flex min-w-0 items-baseline justify-center gap-2">
                    <h1 className="truncate text-base font-bold leading-none text-foreground lg:text-xl">{pm("calendarTitle")}</h1>
                    <p className="shrink-0 text-base font-bold leading-none text-[#1d4ed8] lg:text-xl">{monthLabel}</p>
                  </div>
                  <Link
                    href={href(next)}
                    className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900"
                  >
                    {pm("nextMonth")}
                  </Link>
                </div>
              }
            />
          </Suspense>
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
      maintenancePm: searchParams.maintenancePm,
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
    maintenancePm: searchParams.maintenancePm,
  }

  return (
    <ModuleBackdrop isDark={isDark}>
    <div className="relative z-10 space-y-6">
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

      <div className="rounded-xl border border-[#cbd5e1] bg-[#ffffff] p-3 shadow-sm">
        <Suspense fallback={<div className="h-10 w-full animate-pulse rounded-lg bg-[#e2e8f0]" />}>
          <AssetFilters branches={branches.data} types={types.data} />
        </Suspense>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#cbd5e1] bg-[#ffffff] shadow-sm">
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
                  <tr className="border-b border-[#cbd5e1] bg-[#e2e8f0]">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#0f172a]">
                      {t("code")}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#0f172a]">
                      {t("name")}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#0f172a]">
                      {t("type")}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#0f172a]">
                      {t("ownership")}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#0f172a]">
                      {t("branch")}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#0f172a]">
                      {t("status")}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#0f172a]">
                      {t("maintenancePmColumn")}
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#0f172a]">
                      {t("serialNumber")}
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-[#0f172a]">
                      {t("manage")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0] bg-[#ffffff]">
                  {data.map((asset) => (
                    <tr key={asset.id} className="bg-[#ffffff] transition-colors hover:bg-[#f1f5f9]">
                      <td className="px-5 py-3.5 font-semibold text-[#0f172a]">{asset.code}</td>
                      <td className="px-5 py-3.5 text-[#0f172a]">
                        {asset.name}
                      </td>
                      <td className="px-5 py-3.5 text-[#334155]">{asset.typeName}</td>
                      <td className="px-5 py-3.5 text-[#334155]">{t(`own_${asset.ownership}`)}</td>
                      <td className="px-5 py-3.5 text-[#334155]">{asset.branchName}</td>
                      <td className="px-5 py-3.5 text-[#334155]">{t(`st_${asset.status}`)}</td>
                      <td className="px-5 py-3.5">
                        <AssetPmToggle asset={asset} canUpdate={canUpdate} />
                      </td>
                      <td className="px-5 py-3.5 text-[#334155]">{asset.serialNumber ?? "—"}</td>
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
      </div>
    </div>
    </ModuleBackdrop>
  )
}
