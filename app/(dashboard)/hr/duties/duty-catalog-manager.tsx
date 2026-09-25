"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, Plus, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GlassCard, GlassDialog, GlassInput } from "@/components/glass"
import type { DutyCatalogCategory, DutyImportPreview } from "@/modules/hr"

const fieldClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-500 dark:bg-slate-950/55"

type RenameTarget = { kind: "category" | "item"; id: string; name: string }

function IconButton({
  title,
  onClick,
  disabled,
  children,
  danger,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md p-1.5 disabled:opacity-30 ${
        danger
          ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}

export function DutyCatalogManager({
  categories,
  canEdit,
}: {
  categories: DutyCatalogCategory[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const [newCategory, setNewCategory] = useState("")
  const [newItems, setNewItems] = useState<Record<string, string>>({})
  const [rename, setRename] = useState<RenameTarget | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState("")
  const [preview, setPreview] = useState<DutyImportPreview | null>(null)

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return categories
      .filter((category) => showInactive || category.isActive)
      .map((category) => {
        const categoryHit = q ? category.name.toLowerCase().includes(q) : true
        const items = category.items.filter(
          (item) =>
            (showInactive || item.isActive) && (categoryHit || item.name.toLowerCase().includes(q))
        )
        return { category, items, show: categoryHit || items.length > 0 }
      })
      .filter((row) => row.show)
  }, [categories, search, showInactive])

  async function send(url: string, method: string, body?: unknown) {
    setBusy(true)
    setErr(null)
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    setBusy(false)
    const json = (await res.json().catch(() => ({}))) as { error?: string; data?: unknown }
    if (!res.ok) {
      setErr(json.error ?? "บันทึกไม่สำเร็จ")
      return null
    }
    return json
  }

  async function addCategory() {
    const name = newCategory.trim()
    if (!name) return
    if (await send("/api/hr/duties/categories", "POST", { name })) {
      setNewCategory("")
      router.refresh()
    }
  }

  async function addItem(categoryId: string) {
    const name = (newItems[categoryId] ?? "").trim()
    if (!name) return
    if (await send("/api/hr/duties/items", "POST", { categoryId, name })) {
      setNewItems((prev) => ({ ...prev, [categoryId]: "" }))
      router.refresh()
    }
  }

  async function patch(kind: "category" | "item", id: string, body: Record<string, unknown>) {
    const base = kind === "category" ? "/api/hr/duties/categories" : "/api/hr/duties/items"
    if (await send(`${base}/${id}`, "PATCH", body)) router.refresh()
  }

  async function remove(kind: "category" | "item", id: string, name: string) {
    if (!window.confirm(`ลบ ${name} หรือไม่`)) return
    const base = kind === "category" ? "/api/hr/duties/categories" : "/api/hr/duties/items"
    if (await send(`${base}/${id}`, "DELETE")) router.refresh()
  }

  async function saveRename() {
    if (!rename) return
    const name = rename.name.trim()
    if (!name) return
    await patch(rename.kind, rename.id, { name })
    setRename(null)
  }

  async function runImport(confirm: boolean) {
    const json = (await send("/api/hr/duties/import", "POST", { text: importText, confirm })) as
      | { data: DutyImportPreview & { applied: boolean } }
      | null
    if (!json) return
    if (confirm) {
      setImportOpen(false)
      setImportText("")
      setPreview(null)
      router.refresh()
      return
    }
    setPreview(json.data)
  }

  return (
    <div className="space-y-4">
      <GlassCard padding="sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <GlassInput
              label="ค้นหา"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ชื่อหมวดหรือรายการ"
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-foreground">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            แสดงที่ปิดใช้งาน
          </label>
          {canEdit && (
            <Button
              variant="outline"
              icon={<Upload className="h-4 w-4" />}
              onClick={() => {
                setErr(null)
                setPreview(null)
                setImportOpen(true)
              }}
            >
              นำเข้าจาก Excel
            </Button>
          )}
        </div>
        {canEdit ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-64 flex-1">
              <GlassInput
                label="เพิ่มหมวด"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="เช่น ราคา"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addCategory()
                }}
              />
            </div>
            <Button icon={<Plus className="h-4 w-4" />} loading={busy} onClick={() => void addCategory()}>
              เพิ่มหมวด
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            ดูได้อย่างเดียว — เพิ่มหรือแก้สมุดได้เฉพาะผู้ดูแลระบบ ติ๊กรายการใช้ได้ที่ตำแหน่งและบุคลากร
          </p>
        )}
      </GlassCard>

      {err && !importOpen && !rename && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {err}
        </p>
      )}

      {categories.length === 0 && (
        <GlassCard className="px-5 py-12 text-center">
          <p className="text-sm font-medium text-foreground">ยังไม่มีหมวดหน้าที่</p>
          <p className="mt-1 text-sm text-muted-foreground">
            เพิ่มหมวดทีละหมวด หรือวางจาก Excel สองคอลัมน์ หมวด กับ รายการ
          </p>
        </GlassCard>
      )}

      {categories.length > 0 && visible.length === 0 && (
        <p className="text-sm text-muted-foreground">ไม่พบหมวดหรือรายการที่ตรงคำค้น</p>
      )}

      {visible.map(({ category, items }) => {
        const siblings = categories.map((c) => c.id)
        const index = siblings.indexOf(category.id)
        return (
          <GlassCard key={category.id} padding="sm" className={category.isActive ? "" : "opacity-70"}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">{category.name}</h2>
                <span className="text-xs text-muted-foreground">{category.items.length} รายการ</span>
                {!category.isActive && <Badge variant="outline">ปิด</Badge>}
              </div>
              {canEdit && (
                <div className="flex items-center gap-1">
                  <IconButton title="เลื่อนขึ้น" disabled={busy || index <= 0} onClick={() => void patch("category", category.id, { move: "up" })}>
                    <ArrowUp className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    title="เลื่อนลง"
                    disabled={busy || index >= siblings.length - 1}
                    onClick={() => void patch("category", category.id, { move: "down" })}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </IconButton>
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
                    onClick={() => {
                      setErr(null)
                      setRename({ kind: "category", id: category.id, name: category.name })
                    }}
                  >
                    แก้ชื่อ
                  </button>
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                    onClick={() => void patch("category", category.id, { isActive: !category.isActive })}
                  >
                    {category.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                  </button>
                  {category.items.length === 0 && (
                    <IconButton title="ลบหมวด" danger onClick={() => void remove("category", category.id, category.name)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  )}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <ul className="mt-2 divide-y divide-border/60">
                {items.map((item) => {
                  const itemIndex = category.items.findIndex((i) => i.id === item.id)
                  const used = item.positionCount + item.seatCount > 0
                  return (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                      <div className="min-w-0">
                        <span className={item.isActive ? "text-sm text-foreground" : "text-sm text-muted-foreground line-through"}>
                          {item.name}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {item.positionCount} ตำแหน่ง · {item.seatCount} คน
                        </span>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <IconButton title="เลื่อนขึ้น" disabled={busy || itemIndex <= 0} onClick={() => void patch("item", item.id, { move: "up" })}>
                            <ArrowUp className="h-3.5 w-3.5" />
                          </IconButton>
                          <IconButton
                            title="เลื่อนลง"
                            disabled={busy || itemIndex >= category.items.length - 1}
                            onClick={() => void patch("item", item.id, { move: "down" })}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </IconButton>
                          <button
                            type="button"
                            className="rounded-md px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
                            onClick={() => {
                              setErr(null)
                              setRename({ kind: "item", id: item.id, name: item.name })
                            }}
                          >
                            แก้ชื่อ
                          </button>
                          <button
                            type="button"
                            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                            onClick={() => void patch("item", item.id, { isActive: !item.isActive })}
                          >
                            {item.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                          </button>
                          {!used && (
                            <IconButton title="ลบรายการ" danger onClick={() => void remove("item", item.id, item.name)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </IconButton>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {canEdit && category.isActive && !search.trim() && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  className={fieldClass}
                  value={newItems[category.id] ?? ""}
                  placeholder="เพิ่มรายการในหมวดนี้"
                  onChange={(e) => setNewItems((prev) => ({ ...prev, [category.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void addItem(category.id)
                  }}
                />
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void addItem(category.id)}>
                  เพิ่ม
                </Button>
              </div>
            )}
          </GlassCard>
        )
      })}

      <GlassDialog
        open={rename !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRename(null)
            setErr(null)
          }
        }}
        title={rename?.kind === "category" ? "แก้ชื่อหมวด" : "แก้ชื่อรายการ"}
      >
        {err && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {err}
          </p>
        )}
        <GlassInput
          label="ชื่อ"
          value={rename?.name ?? ""}
          onChange={(e) => setRename((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          ตำแหน่งและบุคลากรที่ติ๊กข้อนี้ไว้จะเห็นชื่อใหม่ทันที
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setRename(null)}>
            ยกเลิก
          </Button>
          <Button size="sm" loading={busy} onClick={() => void saveRename()}>
            บันทึก
          </Button>
        </div>
      </GlassDialog>

      <GlassDialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open)
          if (!open) {
            setErr(null)
            setPreview(null)
          }
        }}
        title="นำเข้าจาก Excel"
      >
        {err && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {err}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          คัดลอกสองคอลัมน์จาก Excel คือ หมวด กับ รายการ แล้ววางด้านล่าง แถวที่ช่องหมวดว่างจะใช้หมวดของแถวก่อนหน้า
          รายการที่มีอยู่แล้วจะถูกข้าม
        </p>
        <textarea
          className={`${fieldClass} mt-3 font-mono`}
          rows={10}
          value={importText}
          onChange={(e) => {
            setImportText(e.target.value)
            setPreview(null)
          }}
          placeholder={"ราคา\tอัพเดตราคาในระบบ\n\tอัพเดตราคาจากกลุ่มไลน์\nลูกค้า\tรับรองลูกค้า"}
        />
        {preview && (
          <div className="mt-3 space-y-2 rounded-lg border border-border px-3 py-2 text-sm">
            <p className="text-foreground">
              หมวดใหม่ {preview.newCategories.length} · รายการใหม่ {preview.newItems.length} · ข้ามเพราะมีแล้ว{" "}
              {preview.skipped}
            </p>
            {preview.newCategories.length > 0 && (
              <p className="text-xs text-muted-foreground">หมวดใหม่: {preview.newCategories.join(", ")}</p>
            )}
            {preview.newItems.length > 0 && (
              <ul className="max-h-48 overflow-y-auto text-xs text-muted-foreground">
                {preview.newItems.map((item) => (
                  <li key={`${item.category}-${item.name}`}>
                    {item.category} — {item.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(false)}>
            ยกเลิก
          </Button>
          {preview ? (
            <Button
              size="sm"
              loading={busy}
              disabled={preview.newCategories.length === 0 && preview.newItems.length === 0}
              onClick={() => void runImport(true)}
            >
              ยืนยันนำเข้า
            </Button>
          ) : (
            <Button size="sm" loading={busy} disabled={!importText.trim()} onClick={() => void runImport(false)}>
              ตรวจสอบ
            </Button>
          )}
        </div>
      </GlassDialog>
    </div>
  )
}
