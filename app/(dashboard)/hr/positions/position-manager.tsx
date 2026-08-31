"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { GlassCard, GlassDialog, GlassInput } from "@/components/glass"
import { Badge } from "@/components/ui/badge"
import type { PositionTreeNode } from "@/modules/hr"

type BranchOpt = { id: string; name: string; code: string }
type DeptOpt = { id: string; name: string; code: string | null }

type View = {
  branch: { id: string; code: string; name: string }
  tree: PositionTreeNode[]
  totals: { positions: number; headcount: number; occupied: number; vacancy: number }
}

type FormState = {
  name: string
  code: string
  parentId: string
  departmentId: string
  headcount: string
  sortOrder: string
  responsibilities: string
  isActive: boolean
}

const emptyForm: FormState = {
  name: "",
  code: "",
  parentId: "",
  departmentId: "",
  headcount: "1",
  sortOrder: "0",
  responsibilities: "",
  isActive: true,
}

function flatten(nodes: PositionTreeNode[]): PositionTreeNode[] {
  const out: PositionTreeNode[] = []
  const walk = (list: PositionTreeNode[]) => {
    for (const node of list) {
      out.push(node)
      walk(node.children)
    }
  }
  walk(nodes)
  return out
}

function descendantIds(node: PositionTreeNode): string[] {
  const out: string[] = [node.id]
  for (const child of node.children) out.push(...descendantIds(child))
  return out
}

const fieldClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-500 dark:bg-slate-950/55"

export function PositionManager({
  branches,
  branchId,
  departments,
  view,
  perms,
}: {
  branches: BranchOpt[]
  branchId: string
  departments: DeptOpt[]
  view: View | null
  perms: { canCreate: boolean; canUpdate: boolean; canDelete: boolean }
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState<PositionTreeNode | null>(null)
  const [creatingUnder, setCreatingUnder] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<PositionTreeNode | null>(null)

  const rows = useMemo(() => (view ? flatten(view.tree) : []), [view])

  /** ห้ามเลือกตัวเองหรือลูกของตัวเองเป็นหัวหน้า — กันวงกลมก่อนยิง API */
  const parentOptions = useMemo(() => {
    const blocked = new Set(editing ? descendantIds(editing) : [])
    return rows.filter((r) => !blocked.has(r.id))
  }, [rows, editing])

  function openCreate(parentId: string | null) {
    setEditing(null)
    setCreatingUnder(parentId)
    setForm({ ...emptyForm, parentId: parentId ?? "" })
    setErr(null)
    setDialogOpen(true)
  }

  function openEdit(node: PositionTreeNode) {
    setEditing(node)
    setCreatingUnder(null)
    setForm({
      name: node.name,
      code: node.code ?? "",
      parentId: node.parentId ?? "",
      departmentId: node.departmentId ?? "",
      headcount: String(node.headcount),
      sortOrder: String(node.sortOrder),
      responsibilities: node.responsibilities ?? "",
      isActive: node.isActive,
    })
    setErr(null)
    setDialogOpen(true)
  }

  async function submit() {
    if (!form.name.trim()) {
      setErr("กรุณากรอกชื่อตำแหน่ง")
      return
    }
    const headcount = Number(form.headcount)
    const sortOrder = Number(form.sortOrder)
    if (!Number.isInteger(headcount) || headcount < 0) {
      setErr("อัตรากำลังต้องเป็นจำนวนเต็มไม่ติดลบ")
      return
    }
    if (!Number.isInteger(sortOrder)) {
      setErr("ลำดับต้องเป็นจำนวนเต็ม")
      return
    }

    setBusy(true)
    setErr(null)
    const payload = {
      name: form.name.trim(),
      code: form.code,
      parentId: form.parentId,
      departmentId: form.departmentId,
      headcount,
      sortOrder,
      responsibilities: form.responsibilities,
      ...(editing ? { isActive: form.isActive } : { branchId }),
    }
    const res = await fetch(editing ? `/api/hr/positions/${editing.id}` : "/api/hr/positions", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    setBusy(false)
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      setErr(j.error ?? "บันทึกไม่สำเร็จ")
      return
    }
    setDialogOpen(false)
    router.refresh()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setBusy(true)
    setErr(null)
    const res = await fetch(`/api/hr/positions/${deleteTarget.id}`, { method: "DELETE" })
    setBusy(false)
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      setErr(j.error ?? "ลบไม่สำเร็จ")
      return
    }
    setDeleteTarget(null)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <GlassCard padding="sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56">
            <Select
              label="สาขา"
              value={branchId}
              onChange={(e) => router.push(`/hr/positions?branchId=${e.target.value}`)}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </Select>
          </div>
          {perms.canCreate && branchId && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => openCreate(null)}>
              เพิ่มตำแหน่งระดับบนสุด
            </Button>
          )}
        </div>
      </GlassCard>

      {err && !dialogOpen && !deleteTarget && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {err}
        </p>
      )}

      {view && (
        <p className="text-sm text-muted-foreground">
          ตำแหน่ง {view.totals.positions} · อัตรากำลัง {view.totals.headcount} · นั่งอยู่{" "}
          {view.totals.occupied} · ว่าง {view.totals.vacancy}
        </p>
      )}

      {view && rows.length === 0 && (
        <GlassCard className="px-5 py-12 text-center">
          <p className="text-sm font-medium text-foreground">ยังไม่มีตำแหน่งในสาขานี้</p>
          <p className="mt-1 text-sm text-muted-foreground">
            เริ่มจากตำแหน่งสูงสุด แล้วเพิ่มลูกน้องใต้แต่ละตำแหน่ง
          </p>
        </GlassCard>
      )}

      {view && rows.length > 0 && (
        <GlassCard padding="sm" className="overflow-x-auto px-2 py-2">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2 font-medium">ตำแหน่ง</th>
                <th className="px-3 py-2 font-medium">แผนก</th>
                <th className="px-3 py-2 text-right font-medium">อัตรา</th>
                <th className="px-3 py-2 text-right font-medium">นั่งอยู่</th>
                <th className="px-3 py-2 text-right font-medium">ว่าง</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((node) => (
                <tr key={node.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2">
                    <div
                      className="flex items-center gap-1.5"
                      style={{ paddingLeft: `${node.depth * 18}px` }}
                    >
                      {node.depth > 0 && (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="font-medium text-foreground">{node.name}</span>
                      {node.code && (
                        <span className="font-mono text-xs text-muted-foreground">{node.code}</span>
                      )}
                      {!node.isActive && <Badge variant="outline">ปิด</Badge>}
                    </div>
                    {node.responsibilities && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground" style={{ paddingLeft: `${node.depth * 18 + 20}px` }}>
                        {node.responsibilities.split("\n")[0]}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{node.department?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{node.headcount}</td>
                  <td className="px-3 py-2 text-right">{node.occupantCount}</td>
                  <td className="px-3 py-2 text-right">
                    {node.vacancy > 0 ? (
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        {node.vacancy}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {perms.canCreate && (
                        <button
                          type="button"
                          title="เพิ่มลูกน้องใต้ตำแหน่งนี้"
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          onClick={() => openCreate(node.id)}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      )}
                      {perms.canUpdate && (
                        <button
                          type="button"
                          className="rounded-md px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
                          onClick={() => openEdit(node)}
                        >
                          แก้ไข
                        </button>
                      )}
                      {perms.canDelete && (
                        <button
                          type="button"
                          title="ลบหรือปิดใช้งาน"
                          className="rounded-md p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                          onClick={() => {
                            setErr(null)
                            setDeleteTarget(node)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}

      <GlassDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setErr(null)
        }}
        title={editing ? "แก้ไขตำแหน่ง" : creatingUnder ? "เพิ่มตำแหน่งใต้หัวหน้า" : "เพิ่มตำแหน่ง"}
      >
        <div className="space-y-3">
          {err && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {err}
            </p>
          )}
          <GlassInput
            label="ชื่อตำแหน่ง"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="เช่น ผู้จัดการฝ่ายผลิต"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <GlassInput
              label="รหัสตำแหน่ง"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="ไม่บังคับ"
            />
            <Select
              label="หัวหน้า"
              value={form.parentId}
              onChange={(e) => setForm({ ...form, parentId: e.target.value })}
            >
              <option value="">— ระดับบนสุด —</option>
              {parentOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {"— ".repeat(opt.depth)}
                  {opt.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Select
              label="แผนก"
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              hint="ใช้เป็นป้ายกำกับ"
            >
              <option value="">— ไม่ระบุ —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <GlassInput
              label="อัตรากำลัง"
              type="number"
              min={0}
              value={form.headcount}
              onChange={(e) => setForm({ ...form, headcount: e.target.value })}
            />
            <GlassInput
              label="ลำดับแสดง"
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            />
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">หน้าที่ความรับผิดชอบ</span>
            <textarea
              className={fieldClass}
              rows={6}
              maxLength={5000}
              value={form.responsibilities}
              onChange={(e) => setForm({ ...form, responsibilities: e.target.value })}
              placeholder={"บรรทัดละ 1 ข้อ\nกำกับดูแลสายการผลิต\nรายงานผลผลิตรายวัน"}
            />
            <span className="text-xs text-muted-foreground">บรรทัดละ 1 ข้อ</span>
          </label>
          {editing && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              ใช้งานตำแหน่งนี้
            </label>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
            ยกเลิก
          </Button>
          <Button size="sm" loading={busy} onClick={() => void submit()}>
            บันทึก
          </Button>
        </div>
      </GlassDialog>

      <GlassDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
            setErr(null)
          }
        }}
        title="ลบตำแหน่ง"
      >
        {err && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {err}
          </p>
        )}
        <p className="text-sm text-foreground">
          ลบตำแหน่ง {deleteTarget?.name} หรือไม่
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          ถ้ายังมีตำแหน่งลูกหรือมีคนเคยผูกไว้ ระบบจะปิดใช้งานแทนการลบ เพื่อไม่ให้ประวัติขาด
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
            ยกเลิก
          </Button>
          <Button variant="danger" size="sm" loading={busy} onClick={() => void confirmDelete()}>
            ยืนยัน
          </Button>
        </div>
      </GlassDialog>
    </div>
  )
}
