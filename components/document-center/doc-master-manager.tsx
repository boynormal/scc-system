"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { FolderTree, Tags } from "lucide-react"
import { GlassDialog } from "@/components/glass/glass-dialog"
import { SubTabs } from "@/components/shell/sub-tabs"
import { AppDataTable, AppDataTableBody, AppDataTableHead, AppDataTablePanel } from "@/components/shell/app-data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { useTypeConfirm } from "@/components/ui/type-confirm"

type Category = {
  id: string
  parentId: string | null
  code: string | null
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
}
type DocType = { id: string; code: string; name: string; description: string | null; isActive: boolean }
type Tab = "categories" | "types"

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string | { message?: string } } | null
    const message = typeof payload?.error === "string" ? payload.error : payload?.error?.message
    throw new Error(message || "failed")
  }
}

function orderedCategories(rows: Category[]): Category[] {
  const children = new Map<string | null, Category[]>()
  for (const row of rows) {
    const list = children.get(row.parentId) ?? []
    list.push(row)
    children.set(row.parentId, list)
  }
  const out: Category[] = []
  const seen = new Set<string>()
  const walk = (parentId: string | null) => {
    for (const row of children.get(parentId) ?? []) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      out.push(row)
      walk(row.id)
    }
  }
  walk(null)
  for (const row of rows) {
    if (!seen.has(row.id)) out.push(row)
  }
  return out
}

function categoryDepth(rows: Category[], id: string): number {
  const byId = new Map(rows.map((row) => [row.id, row]))
  let depth = 0
  let cursor = byId.get(id)?.parentId ?? null
  const seen = new Set<string>()
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor)
    depth += 1
    cursor = byId.get(cursor)?.parentId ?? null
  }
  return depth
}

export function DocMasterManager({
  categories,
  types,
  canCreate,
  canUpdate,
  canDelete,
}: {
  categories: Category[]
  types: DocType[]
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}) {
  const t = useTranslations("documentCenter")
  const router = useRouter()
  const confirmType = useTypeConfirm()
  const [tab, setTab] = useState<Tab>("categories")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState<Category | "new" | null>(null)
  const [typeOpen, setTypeOpen] = useState<DocType | "new" | null>(null)
  const tree = useMemo(() => orderedCategories(categories), [categories])
  const parentName = useMemo(() => new Map(categories.map((row) => [row.id, row.name])), [categories])

  async function run(task: () => Promise<void>) {
    setError(null)
    setPending(true)
    try {
      await task()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("actionFailed"))
    } finally {
      setPending(false)
    }
  }

  async function remove(url: string, title: string, message: string) {
    const ok = await confirmType({ title, message })
    if (!ok) return
    await run(() => send(url, "DELETE"))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SubTabs
          aria-label={t("mastersTitle")}
          activeKey={tab}
          onChange={(key) => {
            setTab(key as Tab)
            setError(null)
          }}
          items={[
            { key: "categories", label: t("categories"), count: categories.length },
            { key: "types", label: t("types"), count: types.length },
          ]}
        />
        {canCreate ? (
          <Button
            type="button"
            onClick={() => (tab === "categories" ? setCategoryOpen("new") : setTypeOpen("new"))}
          >
            {tab === "categories" ? t("addCategory") : t("addType")}
          </Button>
        ) : null}
      </div>
      <p className="text-sm text-foreground">{tab === "categories" ? t("categoryTabDesc") : t("typeTabDesc")}</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {tab === "categories" ? (
        <AppDataTablePanel>
          {tree.length === 0 ? (
            <EmptyState icon={FolderTree} title={t("noCategories")} />
          ) : (
            <AppDataTable>
              <AppDataTableHead>
                <tr>
                  <th>{t("name")}</th>
                  <th className="hidden xl:table-cell">{t("colCode")}</th>
                  <th className="hidden xl:table-cell">{t("colParent")}</th>
                  <th className="hidden xl:table-cell">{t("sortOrder")}</th>
                  <th>{t("colStatus")}</th>
                  <th>{t("colActions")}</th>
                </tr>
              </AppDataTableHead>
              <AppDataTableBody>
                {tree.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3" style={{ paddingLeft: 16 + categoryDepth(categories, row.id) * 16 }}>
                      {row.name}
                    </td>
                    <td className="hidden px-4 py-3 xl:table-cell">{row.code || "—"}</td>
                    <td className="hidden px-4 py-3 xl:table-cell">{row.parentId ? parentName.get(row.parentId) || "—" : t("noParent")}</td>
                    <td className="hidden px-4 py-3 xl:table-cell">{row.sortOrder}</td>
                    <td className="px-4 py-3">
                      <Badge variant={row.isActive ? "success" : "default"}>{row.isActive ? t("active") : t("inactive")}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {canUpdate ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => setCategoryOpen(row)}>
                            {t("editCategory")}
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => void remove(`/api/document-center/categories/${row.id}`, t("deleteCategory"), t("deleteCategoryConfirm"))}
                          >
                            {t("deleteCategory")}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </AppDataTableBody>
            </AppDataTable>
          )}
        </AppDataTablePanel>
      ) : (
        <AppDataTablePanel>
          {types.length === 0 ? (
            <EmptyState icon={Tags} title={t("noTypes")} />
          ) : (
            <AppDataTable>
              <AppDataTableHead>
                <tr>
                  <th>{t("colCode")}</th>
                  <th>{t("name")}</th>
                  <th className="hidden xl:table-cell">{t("description")}</th>
                  <th>{t("colStatus")}</th>
                  <th>{t("colActions")}</th>
                </tr>
              </AppDataTableHead>
              <AppDataTableBody>
                {types.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">{row.code}</td>
                    <td className="px-4 py-3">{row.name}</td>
                    <td className="hidden px-4 py-3 xl:table-cell">{row.description || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={row.isActive ? "success" : "default"}>{row.isActive ? t("active") : t("inactive")}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {canUpdate ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => setTypeOpen(row)}>
                            {t("editType")}
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => void remove(`/api/document-center/types/${row.id}`, t("deleteType"), t("deleteTypeConfirm"))}
                          >
                            {t("deleteType")}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </AppDataTableBody>
            </AppDataTable>
          )}
        </AppDataTablePanel>
      )}

      <GlassDialog
        open={categoryOpen !== null}
        onOpenChange={(open) => !open && setCategoryOpen(null)}
        title={categoryOpen === "new" ? t("addCategory") : t("editCategory")}
        solid
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto"
      >
        {categoryOpen ? (
          <CategoryForm
            categories={categories}
            current={categoryOpen === "new" ? null : categoryOpen}
            pending={pending}
            onSubmit={(body) =>
              run(async () => {
                if (categoryOpen === "new") await send("/api/document-center/categories", "POST", body)
                else await send(`/api/document-center/categories/${categoryOpen.id}`, "PATCH", body)
                setCategoryOpen(null)
              })
            }
          />
        ) : null}
      </GlassDialog>
      <GlassDialog
        open={typeOpen !== null}
        onOpenChange={(open) => !open && setTypeOpen(null)}
        title={typeOpen === "new" ? t("addType") : t("editType")}
        solid
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto"
      >
        {typeOpen ? (
          <TypeForm
            current={typeOpen === "new" ? null : typeOpen}
            pending={pending}
            onSubmit={(body) =>
              run(async () => {
                if (typeOpen === "new") await send("/api/document-center/types", "POST", body)
                else await send(`/api/document-center/types/${typeOpen.id}`, "PATCH", body)
                setTypeOpen(null)
              })
            }
          />
        ) : null}
      </GlassDialog>
    </div>
  )
}

function CategoryForm({
  categories,
  current,
  pending,
  onSubmit,
}: {
  categories: Category[]
  current: Category | null
  pending: boolean
  onSubmit: (body: Record<string, unknown>) => void
}) {
  const t = useTranslations("documentCenter")
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (pending) return
        const form = new FormData(event.currentTarget)
        onSubmit({
          name: String(form.get("name") || ""),
          code: String(form.get("code") || "") || null,
          description: String(form.get("description") || "") || null,
          parentId: String(form.get("parentId") || "") || null,
          sortOrder: Number(form.get("sortOrder") || 0),
          isActive: form.get("isActive") === "on",
        })
      }}
    >
      <Input name="name" label={t("name")} required defaultValue={current?.name ?? ""} />
      <Input name="code" label={t("colCode")} defaultValue={current?.code ?? ""} />
      <Select
        name="parentId"
        label={t("parentCategory")}
        defaultValue={current?.parentId ?? ""}
        options={[{ value: "", label: t("noParent") }, ...categories.filter((row) => row.id !== current?.id).map((row) => ({ value: row.id, label: row.name }))]}
      />
      <Input name="description" label={t("description")} defaultValue={current?.description ?? ""} />
      <Input name="sortOrder" label={t("sortOrder")} type="number" min={0} defaultValue={current?.sortOrder ?? 0} />
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input name="isActive" type="checkbox" defaultChecked={current?.isActive ?? true} />
        {t("active")}
      </label>
      <div className="flex justify-end">
        <Button type="submit" loading={pending} disabled={pending}>{t("save")}</Button>
      </div>
    </form>
  )
}

function TypeForm({
  current,
  pending,
  onSubmit,
}: {
  current: DocType | null
  pending: boolean
  onSubmit: (body: Record<string, unknown>) => void
}) {
  const t = useTranslations("documentCenter")
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (pending) return
        const form = new FormData(event.currentTarget)
        onSubmit({
          code: String(form.get("code") || ""),
          name: String(form.get("name") || ""),
          description: String(form.get("description") || "") || null,
          isActive: form.get("isActive") === "on",
        })
      }}
    >
      <Input name="code" label={t("typeCode")} required defaultValue={current?.code ?? ""} />
      <Input name="name" label={t("name")} required defaultValue={current?.name ?? ""} />
      <Input name="description" label={t("description")} defaultValue={current?.description ?? ""} />
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input name="isActive" type="checkbox" defaultChecked={current?.isActive ?? true} />
        {t("active")}
      </label>
      <div className="flex justify-end">
        <Button type="submit" loading={pending} disabled={pending}>{t("save")}</Button>
      </div>
    </form>
  )
}
