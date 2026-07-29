"use client"

import { useEffect, useState } from "react"
import { ROLE_MATRIX_GROUPS } from "@/shared/permissions/role-matrix"
import type { Action, Resource } from "@/lib/permissions"
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions"

type Props = {
  roleId?: string
  roleName?: string
  moduleAccess: string[] | "all" | null | undefined
}

function mergeEffective(roleName: string, stored: Record<string, unknown> | null): Record<string, Action[]> {
  const defaults = DEFAULT_ROLE_PERMISSIONS[roleName] ?? {}
  const out: Record<string, Action[]> = { ...defaults }
  if (!stored) return out
  for (const [key, value] of Object.entries(stored)) {
    if (key === "moduleAccess") continue
    if (Array.isArray(value)) out[key] = value as Action[]
  }
  return out
}

function actionSummary(actions: Action[] | undefined): string {
  if (!actions?.length) return "—"
  const labels: Record<Action, string> = {
    read: "อ่าน",
    create: "สร้าง",
    update: "แก้ไข",
    delete: "ลบ",
    approve: "อนุมัติ",
  }
  return actions.map((a) => labels[a] ?? a).join(", ")
}

export function UserEffectiveAccessSummary({ roleId, roleName: roleNameProp, moduleAccess }: Props) {
  const [roleName, setRoleName] = useState(roleNameProp ?? "")
  const [perms, setPerms] = useState<Record<string, Action[]> | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!roleId) {
      setPerms(null)
      setRoleName("")
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/settings/roles/${roleId}`)
      .then((r) => r.json())
      .then(({ data }) => {
        if (cancelled || !data) return
        setRoleName(data.name)
        const stored = (data.permissions ?? null) as Record<string, unknown> | null
        setPerms(mergeEffective(data.name, stored))
      })
      .catch(() => {
        if (!cancelled) setPerms(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [roleId])

  const moduleNote =
    moduleAccess === null || moduleAccess === undefined
      ? "มองเห็นตามสิทธิ์อ่านของ Role"
      : moduleAccess === "all"
        ? "มองเห็นทุกโมดูล (override)"
        : `มองเห็นเฉพาะ ${moduleAccess.length} โมดูล (override)`

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">สรุปสิทธิ์ที่ได้จาก Role</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          สิทธิ์อ่าน/เขียนมาจาก Role — ที่หน้านี้ปรับได้แค่การมองเห็นโมดูล (override)
        </p>
      </div>

      {!roleId ? (
        <p className="text-sm text-muted-foreground">เลือก Role เพื่อดูสรุปสิทธิ์</p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Role: <span className="font-medium text-foreground">{roleName || "—"}</span>
            {" · "}
            {moduleNote}
          </p>
          <div className="max-h-48 space-y-1 overflow-y-auto text-xs">
            {ROLE_MATRIX_GROUPS.flatMap((g) =>
              g.rows.map((row) => {
                const actions = perms?.[row.resource as Resource]
                if (!actions?.length) return null
                return (
                  <div
                    key={row.resource}
                    className="flex items-start justify-between gap-3 border-b border-border/60 py-1 last:border-0"
                  >
                    <span className="text-foreground">{row.label}</span>
                    <span className="shrink-0 text-muted-foreground">{actionSummary(actions)}</span>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}
