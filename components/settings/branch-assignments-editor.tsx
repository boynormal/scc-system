"use client"

import { Plus, Trash2 } from "lucide-react"
import { Select } from "@/components/ui/select"
import { GlassButton } from "@/components/glass"

export type BranchAssignmentRow = {
  key: string
  id?: string
  branchId: string
  roleId: string
}

type Option = { id: string; name: string }

type Props = {
  rows: BranchAssignmentRow[]
  onChange: (rows: BranchAssignmentRow[]) => void
  branches: Option[]
  roles: Option[]
  error?: string
}

function nextKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  return `row-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function emptyAssignmentRow(defaults?: { branchId?: string; roleId?: string }): BranchAssignmentRow {
  return {
    key: nextKey(),
    branchId: defaults?.branchId ?? "",
    roleId: defaults?.roleId ?? "",
  }
}

export function BranchAssignmentsEditor({ rows, onChange, branches, roles, error }: Props) {
  const used = new Set(rows.map((r) => r.branchId).filter(Boolean))
  const canAdd = branches.some((b) => !used.has(b.id))

  function updateRow(key: string, patch: Partial<BranchAssignmentRow>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function removeRow(key: string) {
    if (rows.length <= 1) return
    onChange(rows.filter((r) => r.key !== key))
  }

  function addRow() {
    const nextBranch = branches.find((b) => !used.has(b.id))
    onChange([
      ...rows,
      emptyAssignmentRow({
        branchId: nextBranch?.id ?? "",
        roleId: rows[0]?.roleId || roles[0]?.id || "",
      }),
    ])
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-3 py-2 font-medium text-foreground">สาขา</th>
              <th className="px-3 py-2 font-medium text-foreground">Role</th>
              <th className="w-12 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const otherUsed = new Set(rows.filter((r) => r.key !== row.key).map((r) => r.branchId).filter(Boolean))
              const branchOptions = branches
                .filter((b) => b.id === row.branchId || !otherUsed.has(b.id))
                .map((b) => ({ value: b.id, label: b.name }))
              return (
                <tr key={row.key} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 align-top">
                    <Select
                      required
                      placeholder="เลือกสาขา"
                      options={branchOptions}
                      value={row.branchId}
                      onChange={(e) => updateRow(row.key, { branchId: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Select
                      required
                      placeholder="เลือก Role"
                      options={roles.map((r) => ({ value: r.id, label: r.name }))}
                      value={row.roleId}
                      onChange={(e) => updateRow(row.key, { roleId: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <button
                      type="button"
                      disabled={rows.length <= 1}
                      onClick={() => removeRow(row.key)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-500/10"
                      aria-label="ลบสาขา"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <GlassButton type="button" variant="outline" size="sm" disabled={!canAdd} onClick={addRow} icon={<Plus className="h-4 w-4" />}>
        เพิ่มสาขา
      </GlassButton>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <p className="text-xs text-muted-foreground">
        คนหนึ่งคนกำหนด Role ได้สาขาละหนึ่ง Role — บันทึกแล้วควรออกจากระบบแล้วเข้าใหม่เพื่ออัปเดตสิทธิ์
      </p>
    </div>
  )
}
