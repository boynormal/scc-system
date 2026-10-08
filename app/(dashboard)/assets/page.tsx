import { Suspense, type ReactNode } from "react"
import Link from "next/link"
import { Plus, ClipboardList } from "lucide-react"
import { auth } from "@/lib/auth"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { APPEARANCE_COOKIE, resolveAppearance } from "@/shared/appearance"
import { prisma } from "@/shared/db"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { listAccessibleBranches, listAssets } from "@/modules/assets"
import { AssetFilters } from "@/components/assets/asset-filters"
import { EmptyState } from "@/components/ui/empty-state"
import { GlassCard } from "@/components/glass"
import { ListPagination, SSR_PAGE_SIZE, parsePage } from "@/components/ui/list-pagination"
import { cn } from "@/lib/utils"

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
  }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  const t = await getTranslations("assets")
  const pm = await getTranslations("pmCheck")
  const searchParams = await props.searchParams
  const tab = searchParams.tab === "pm-check" ? "pm-check" : "register"
  const page = parsePage(searchParams.page)
  const roles = session.user.roles as UserRole[]
  const companyId = session.user.companyId as string

  const tabItems = [
    { key: "register", label: t("title"), href: "/assets" },
    { key: "pm-check", label: pm("title"), href: "/assets?tab=pm-check" },
  ]
  const cookieStore = await cookies()
  const isDark = resolveAppearance(cookieStore.get(APPEARANCE_COOKIE)?.value) === "dark"
  const tabs = (
    <div className="inline-flex items-center gap-1 rounded-full border border-white/50 bg-white/25 p-1 shadow-sm backdrop-blur-xl dark:border-white/15 dark:bg-white/10">
      {tabItems.map((item) => {
        const active = item.key === tab
        return (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-white/80 text-slate-900 shadow-sm dark:bg-white/20 dark:text-foreground"
                : "text-slate-700/80 hover:bg-white/40 hover:text-slate-900 dark:text-foreground/70 dark:hover:bg-white/10 dark:hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )

  if (tab === "pm-check") {
    return (
      <AssetsBackdrop isDark={isDark}>
        <div className="space-y-6">
          {tabs}
          <div>
            <h1 className="text-2xl font-bold text-foreground">{pm("title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{pm("empty")}</p>
          </div>
        </div>
      </AssetsBackdrop>
    )
  }

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
    <AssetsBackdrop isDark={isDark}>
    <div className="space-y-6">
      {tabs}
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
    </AssetsBackdrop>
  )
}

function AssetsBackdrop({ children, isDark }: { children: ReactNode; isDark: boolean }) {
  return (
    <div
      className={cn(
        "relative -m-6 min-h-[calc(100vh-3.5rem)] overflow-hidden bg-gradient-to-br p-6",
        isDark
          ? "dark from-[#050816] via-[#111b45] to-[#34235d] text-slate-100"
          : "from-[#dff4ff] via-[#e8e7ff] to-[#fce7f3] text-slate-900"
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(14,165,233,0.24),transparent_28%),radial-gradient(circle_at_86%_10%,rgba(244,114,182,0.22),transparent_28%),radial-gradient(circle_at_52%_92%,rgba(139,92,246,0.20),transparent_35%)] dark:bg-[radial-gradient(circle_at_14%_12%,rgba(59,130,246,0.28),transparent_28%),radial-gradient(circle_at_86%_10%,rgba(192,132,252,0.22),transparent_30%),radial-gradient(circle_at_52%_92%,rgba(236,72,153,0.14),transparent_35%)]" />
      <div className="pointer-events-none absolute -left-24 -top-24 h-[26rem] w-[26rem] rounded-full bg-cyan-300/20 blur-3xl dark:bg-blue-500/15" />
      <div className="pointer-events-none absolute -right-24 top-4 h-[28rem] w-[28rem] rounded-full bg-rose-300/20 blur-3xl dark:bg-violet-500/15" />
      <div className="pointer-events-none absolute bottom-[-10rem] left-1/3 h-[26rem] w-[26rem] rounded-full bg-violet-300/15 blur-3xl dark:bg-fuchsia-500/10" />
      <div className="relative text-inherit">{children}</div>
    </div>
  )
}
