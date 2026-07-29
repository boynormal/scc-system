"use client"

import { ROLE_MATRIX_GROUPS, MATRIX_ACTIONS, formKey, type MatrixAction } from "@/shared/permissions/role-matrix"
import type { Resource } from "@/lib/permissions"
import { cn } from "@/lib/utils"

type Props = {
  value: Record<string, boolean>
  onChange: (next: Record<string, boolean>) => void
  disabled?: boolean
}

export function RolePermissionMatrix({ value, onChange, disabled }: Props) {
  const toggle = (resource: Resource, action: MatrixAction) => {
    if (disabled) return
    const key = formKey(resource, action)
    onChange({ ...value, [key]: !value[key] })
  }

  const setRow = (resource: Resource, actions: MatrixAction[], enabled: boolean) => {
    if (disabled) return
    const next = { ...value }
    for (const action of actions) next[formKey(resource, action)] = enabled
    onChange(next)
  }

  return (
    <div className="space-y-6 px-5 pb-5">
      {ROLE_MATRIX_GROUPS.map((group) => (
        <div key={group.id}>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60">
                  <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">
                    ทรัพยากร
                  </th>
                  {MATRIX_ACTIONS.map((a) => (
                    <th
                      key={a.id}
                      className="px-2 py-2.5 text-center font-semibold text-muted-foreground w-16"
                    >
                      {a.label}
                    </th>
                  ))}
                  <th className="px-2 py-2.5 text-center font-semibold text-muted-foreground w-20">
                    ทั้งแถว
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {group.rows.map((row) => {
                  const allOn = row.actions.every((a) => value[formKey(row.resource, a)])
                  return (
                    <tr key={row.resource} className="hover:bg-muted/40">
                      <td className="px-3 py-2.5 font-medium text-foreground">{row.label}</td>
                      {MATRIX_ACTIONS.map((a) => {
                        const allowed = row.actions.includes(a.id)
                        return (
                          <td key={a.id} className="px-2 py-2 text-center">
                            {allowed ? (
                              <input
                                type="checkbox"
                                disabled={disabled}
                                checked={!!value[formKey(row.resource, a.id)]}
                                onChange={() => toggle(row.resource, a.id)}
                                className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                                aria-label={`${row.label} ${a.label}`}
                              />
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => setRow(row.resource, row.actions, !allOn)}
                          className={cn(
                            "text-[11px] font-medium disabled:opacity-50",
                            allOn
                              ? "text-muted-foreground hover:text-foreground"
                              : "text-blue-600 hover:text-blue-500 dark:text-blue-400"
                          )}
                        >
                          {allOn ? "ล้าง" : "ทั้งหมด"}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
