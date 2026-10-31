import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { FileText } from "lucide-react"
import { auth } from "@/lib/auth"
import { NotFoundError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { prisma } from "@/shared/db"
import { SSR_PAGE_SIZE, parsePage, ListPagination } from "@/components/ui/list-pagination"
import { AppDataTablePanel } from "@/components/shell/app-data-table"
import { ListFrame } from "@/components/shell/list-frame"
import { EmptyState } from "@/components/ui/empty-state"
import { DocCategoryTree } from "@/components/document-center/doc-category-tree"
import { DocCreateButton } from "@/components/document-center/doc-create-button"
import { DocFilters } from "@/components/document-center/doc-filters"
import { DocGrid } from "@/components/document-center/doc-grid"
import { docHref } from "@/components/document-center/doc-href"
import { DocKpiCards } from "@/components/document-center/doc-kpi-cards"
import { DocPreviewPanel } from "@/components/document-center/doc-preview-panel"
import { DocTable } from "@/components/document-center/doc-table"
import {
  DOC_GRID_PAGE_SIZE,
  canDocumentMasters,
  canDocuments,
  categoryDocumentCounts,
  documentSummary,
  getDocument,
  listCategories,
  listDocuments,
  listTypes,
  rollupCategoryCounts,
  type DocFileKind,
  type DocListMode,
  type DocSort,
} from "@/modules/document_center"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PATHS: Record<DocListMode, string> = {
  all: "/document-center",
  mine: "/document-center/mine",
  favorite: "/document-center/favorites",
  recent: "/document-center/recent",
}

type Query = Record<string, string | undefined>

export async function DocumentLibrary({
  mode,
  searchParams,
}: {
  mode: DocListMode
  searchParams: Promise<Query>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canDocuments(roles, "read")) {
    if (canDocumentMasters(roles, "read")) redirect("/document-center/master-data")
    redirect("/")
  }
  const sp = await searchParams
  const t = await getTranslations("documentCenter")
  const companyId = session.user.companyId as string
  const userId = session.user.id as string
  const view = sp.view === "table" ? "table" : "grid"
  const pageSize = view === "table" ? SSR_PAGE_SIZE : DOC_GRID_PAGE_SIZE
  const sort: DocSort = sp.sort === "name" || sp.sort === "code" ? sp.sort : "updated"
  const fileKind = (["pdf", "image", "excel", "word", "powerpoint"] as DocFileKind[]).find((kind) => kind === sp.file) ?? null
  const scope = { companyId, roles, userId }
  const [summary, categories, counts, types, list] = await Promise.all([
    documentSummary(prisma, scope),
    listCategories(prisma, { companyId, roles, activeOnly: true }),
    categoryDocumentCounts(prisma, scope),
    listTypes(prisma, { companyId, roles, activeOnly: true }),
    listDocuments(prisma, {
      ...scope,
      mode,
      q: sp.q,
      typeId: sp.type,
      categoryId: sp.category,
      branchFilter: sp.branch,
      departmentId: sp.dept,
      status: sp.status === "ACTIVE" || sp.status === "INACTIVE" || sp.status === "DELETED" ? sp.status : null,
      fileKind,
      kpi: sp.kpi === "active" || sp.kpi === "expiring" || sp.kpi === "favorite" ? sp.kpi : null,
      from: sp.from,
      to: sp.to,
      sort,
      page: parsePage(sp.page),
      pageSize,
    }),
  ])
  const pathname = PATHS[mode]
  const query: Query = { ...sp, view: view === "table" ? "table" : undefined }
  const totals = rollupCategoryCounts(
    categories.data.map((row) => ({ id: row.id, parentId: row.parentId })),
    new Map(counts.map((row) => [row.categoryId, row.count]))
  )
  let selected = list.data.find((item) => item.id === sp.selected) ?? null
  if (!selected && sp.selected && UUID.test(sp.selected)) {
    try {
      selected = (await getDocument(prisma, { ...scope, id: sp.selected })).data
    } catch (err) {
      if (!(err instanceof NotFoundError)) throw err
    }
  }
  const filtered = Boolean(sp.q || sp.type || sp.branch || sp.dept || sp.category || sp.status || sp.file || sp.from || sp.to || sp.kpi)
  const canCreate = canDocuments(roles, "create")

  return (
    <ListFrame
      plainPanel
      filters={
        <Suspense fallback={null}>
          <DocFilters
            categories={categories.data}
            canSeeDeleted={canDocuments(roles, "delete")}
          >
            {canCreate ? (
              <DocCreateButton categories={categories.data} types={types.data} />
            ) : null}
          </DocFilters>
        </Suspense>
      }
    >
      <div className="space-y-4">
        {mode === "all" ? (
          <DocKpiCards
            pathname={pathname}
            query={query}
            summary={summary}
            labels={{ total: t("kpiTotal"), active: t("kpiActive"), favorites: t("kpiFavorites") }}
          />
        ) : null}
        <div className="grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_32rem]">
          <DocCategoryTree
            nodes={categories.data.map((row) => ({ ...row, count: totals.get(row.id) ?? 0 }))}
            pathname={pathname}
            query={query}
            title={t("categories")}
            emptyLabel={t("noCategories")}
          />
          <AppDataTablePanel>
            <div className="flex items-center justify-end gap-3 px-4 py-2 text-sm text-foreground">
              <LinkSort pathname={pathname} query={query} sort={sort} labelUpdated={t("sortUpdated")} labelName={t("sortName")} labelCode={t("sortCode")} />
              <Link className={view === "grid" ? "font-semibold underline" : "underline"} href={docHref(pathname, query, { view: null, page: null })}>{t("viewGrid")}</Link>
              <Link className={view === "table" ? "font-semibold underline" : "underline"} href={docHref(pathname, query, { view: "table", page: null })}>{t("viewTable")}</Link>
            </div>
            {list.data.length === 0 ? (
              <EmptyState icon={FileText} title={filtered ? t("noSearchTitle") : t("emptyTitle")} description={filtered ? t("noSearchDesc") : t("emptyDesc")} />
            ) : view === "table" ? (
              <DocTable
                items={list.data}
                pathname={pathname}
                query={query}
                selectedId={selected?.id}
                labels={{
                  name: t("colName"),
                  category: t("colCategory"),
                  type: t("colType"),
                  file: t("colFile"),
                  version: t("colVersion"),
                  updated: t("colUpdated"),
                  favoriteAdd: t("favoriteAdd"),
                  favoriteRemove: t("favoriteRemove"),
                }}
              />
            ) : (
              <DocGrid
                items={list.data}
                pathname={pathname}
                query={query}
                selectedId={selected?.id}
                labels={{
                  favoriteAdd: t("favoriteAdd"),
                  favoriteRemove: t("favoriteRemove"),
                  openDetail: t("openDetail"),
                  download: t("download"),
                  version: t("versionLabel"),
                }}
              />
            )}
            <ListPagination
              pathname={pathname}
              page={list.page}
              totalPages={Math.max(1, Math.ceil(list.total / list.pageSize))}
              total={list.total}
              query={Object.fromEntries(Object.entries(query).filter(([key, value]) => key !== "page" && Boolean(value)))}
            />
          </AppDataTablePanel>
          <DocPreviewPanel
            item={selected}
            pathname={pathname}
            query={query}
            panel={sp.panel === "details" ? "details" : "preview"}
            labels={{
              preview: t("previewTab"),
              details: t("detailsTab"),
              unsupported: t("previewUnsupported"),
              unsupportedDesc: t("previewUnsupportedDesc"),
              download: t("download"),
              openDetail: t("openDetail"),
              empty: t("selectDocument"),
              code: t("code"),
              category: t("category"),
              type: t("type"),
              version: t("versionLabel"),
              updated: t("colUpdated"),
              favoriteAdd: t("favoriteAdd"),
              favoriteRemove: t("favoriteRemove"),
            }}
          />
        </div>
      </div>
    </ListFrame>
  )
}

function LinkSort({
  pathname,
  query,
  sort,
  labelUpdated,
  labelName,
  labelCode,
}: {
  pathname: string
  query: Query
  sort: DocSort
  labelUpdated: string
  labelName: string
  labelCode: string
}) {
  const items: { id: DocSort; label: string }[] = [
    { id: "updated", label: labelUpdated },
    { id: "name", label: labelName },
    { id: "code", label: labelCode },
  ]
  return (
    <div className="mr-auto flex gap-3">
      {items.map((item) => (
        <Link key={item.id} href={docHref(pathname, query, { sort: item.id === "updated" ? null : item.id, page: null })} className={sort === item.id ? "font-semibold underline" : "underline"}>
          {item.label}
        </Link>
      ))}
    </div>
  )
}
