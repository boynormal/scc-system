"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Loader2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import {
  BRANCH_SHARE_MODULES,
  type BranchShareAction,
  type BranchShareModule,
  type BranchSharingSettings,
} from "@/shared/permissions/branch-sharing"

const ACTIONS: BranchShareAction[] = ["view", "edit", "create", "delete", "approve"]

export default function BranchSharingSettingsPage() {
  const t = useTranslations("settings")
  const [flags, setFlags] = useState<BranchSharingSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/settings/branch-sharing")
      .then(async (res) => {
        if (!res.ok) throw new Error("load")
        return res.json() as Promise<{ data: BranchSharingSettings }>
      })
      .then((body) => {
        if (!cancelled) setFlags(body.data)
      })
      .catch(() => {
        if (!cancelled) setError(t("branchSharingLoadError"))
      })
    return () => {
      cancelled = true
    }
  }, [t])

  const toggle = async (moduleId: BranchShareModule, action: BranchShareAction, next: boolean) => {
    if (!flags) return
    const previous = flags
    const row = { ...flags[moduleId], [action]: next }
    const optimistic = { ...flags, [moduleId]: row }
    setFlags(optimistic)
    setSavingKey(`${moduleId}.${action}`)
    setError(null)
    try {
      const res = await fetch("/api/settings/branch-sharing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [moduleId]: row }),
      })
      if (!res.ok) throw new Error("save")
      const body = (await res.json()) as { data: BranchSharingSettings }
      setFlags(body.data)
    } catch {
      setFlags(previous)
      setError(t("branchSharingSaveError"))
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">{t("branchSharingTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("branchSharingDesc")}</p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!flags ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("branchSharingLoading")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-white dark:bg-slate-900">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">{t("branchSharingColumnItem")}</th>
                {ACTIONS.map((action) => (
                  <th
                    key={action}
                    className="w-28 px-3 py-3 text-center font-medium leading-snug"
                  >
                    {t(`branchSharingAction.${action}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BRANCH_SHARE_MODULES.map((moduleId) => (
                <tr key={moduleId} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-4 text-foreground">{t(`branchSharingModule.${moduleId}`)}</td>
                  {ACTIONS.map((action) => {
                    if (action === "approve" && moduleId !== "finance") {
                      return <td key={action} />
                    }
                    const key = `${moduleId}.${action}`
                    return (
                      <td key={action} className="px-3 py-4">
                        <div className="flex justify-center">
                          <Switch
                            checked={flags[moduleId][action]}
                            disabled={savingKey === key}
                            onCheckedChange={(checked) => toggle(moduleId, action, checked)}
                            aria-label={`${t(`branchSharingModule.${moduleId}`)} ${t(`branchSharingAction.${action}`)}`}
                          />
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
