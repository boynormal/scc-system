"use client"

import { useCallback, useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Copy, KeyRound, MonitorSmartphone, Pencil, Plus } from "lucide-react"
import { fetchJson } from "@/lib/client-fetch"
import { GlassCard, GlassDialog } from "@/components/glass"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"
import { formatDateTime } from "./attendance-format"
import { PendingFade } from "@/components/shell/nav-pending"
import { AppDataTable, AppDataTableBody, AppDataTableHead } from "@/components/shell/app-data-table"
import { AttendanceSectionTabs } from "./attendance-chrome"

type SyncRun = { id: string; received: number; inserted: number; duplicates: number; newBadges: number; clientVersion: string | null; createdAt: string }

type DeviceRow = {
  id: string
  name: string
  machineNumber: number | null
  hasKey: boolean
  lastSourceRowId: number
  lastSyncedAt: string | null
  lastClientVersion: string | null
  isActive: boolean
  badgeCount: number
  punchCount: number
  unmappedBadgeCount: number
  syncRuns: SyncRun[]
}

const TZ = "Asia/Bangkok"

export function AttendanceDeviceView({
  branch,
  canManage,
}: {
  branch: { id: string; code: string; name: string }
  canManage: boolean
}) {
  const t = useTranslations("attendance")
  const locale = useLocale()
  const [rows, setRows] = useState<DeviceRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [issuedKey, setIssuedKey] = useState<{ deviceName: string; key: string } | null>(null)
  const [confirmRotate, setConfirmRotate] = useState<DeviceRow | null>(null)
  const [renaming, setRenaming] = useState<DeviceRow | null>(null)
  const [renameName, setRenameName] = useState("")

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetchJson<{ data: DeviceRow[] }>(`/api/hr/attendance/devices?${new URLSearchParams({ branchId: branch.id })}`)
      setRows(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [branch.id])

  useEffect(() => {
    void load()
  }, [load])

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    setBusy(true)
    setActionError(null)
    try {
      return await fn()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
      return null
    } finally {
      setBusy(false)
    }
  }

  async function create() {
    const res = await run(() =>
      fetchJson<{ data: { device: { name: string }; apiKey: string } }>("/api/hr/attendance/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: branch.id, name: name.trim() }),
      })
    )
    if (!res) return
    setCreating(false)
    setName("")
    setIssuedKey({ deviceName: res.data.device.name, key: res.data.apiKey })
    await load()
  }

  async function rotate(device: DeviceRow) {
    const res = await run(() =>
      fetchJson<{ data: { apiKey: string } }>(`/api/hr/attendance/devices/${device.id}/rotate-key`, { method: "POST" })
    )
    setConfirmRotate(null)
    if (!res) return
    setIssuedKey({ deviceName: device.name, key: res.data.apiKey })
    await load()
  }

  function openRename(device: DeviceRow) {
    setRenameName(device.name)
    setRenaming(device)
  }

  async function saveRename() {
    if (!renaming) return
    const next = renameName.trim()
    if (!next || next === renaming.name) {
      setRenaming(null)
      return
    }
    const res = await run(() =>
      fetchJson(`/api/hr/attendance/devices/${renaming.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next }),
      })
    )
    if (!res) return
    setRenaming(null)
    await load()
  }

  async function toggleActive(device: DeviceRow) {
    const res = await run(() =>
      fetchJson(`/api/hr/attendance/devices/${device.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !device.isActive }),
      })
    )
    if (res) await load()
  }

  return (
    <div className="space-y-4">
      <GlassCard padding="md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <AttendanceSectionTabs branchId={branch.id} tab="devices" />
            <p className="text-sm text-muted-foreground">{t("devices.hint")}</p>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-1" aria-hidden />
              {t("devices.add")}
            </Button>
          )}
        </div>
        {actionError && <p className="mt-2 text-sm text-red-600">{actionError}</p>}
      </GlassCard>

      <PendingFade scope="section">
      {error ? (
        <GlassCard padding="none">
          <ErrorState description={error} onRetry={() => void load()} />
        </GlassCard>
      ) : !rows ? (
        <GlassCard padding="none">
          <LoadingState title={t("loading")} />
        </GlassCard>
      ) : rows.length === 0 ? (
        <GlassCard padding="none">
          <EmptyState icon={MonitorSmartphone} title={t("devices.emptyTitle")} description={t("devices.emptyDescription")} />
        </GlassCard>
      ) : (
        rows.map((d) => (
          <GlassCard key={d.id} padding="md">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">{d.name}</h3>
                  {d.isActive ? <Badge variant="success">{t("devices.active")}</Badge> : <Badge>{t("devices.inactive")}</Badge>}
                </div>
                <dl className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">{t("devices.lastSynced")}</dt>
                  <dd>{formatDateTime(d.lastSyncedAt, TZ, locale)}</dd>
                  <dt className="text-muted-foreground">{t("devices.clientVersion")}</dt>
                  <dd>{d.lastClientVersion ?? "—"}</dd>
                  <dt className="text-muted-foreground">{t("devices.punches")}</dt>
                  <dd>{d.punchCount.toLocaleString()}</dd>
                  <dt className="text-muted-foreground">{t("devices.badges")}</dt>
                  <dd>
                    {d.badgeCount}
                    {d.unmappedBadgeCount > 0 && (
                      <span className="text-amber-700 dark:text-amber-300"> ({t("devices.unmapped", { count: d.unmappedBadgeCount })})</span>
                    )}
                  </dd>
                </dl>
              </div>
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => openRename(d)}>
                    <Pencil className="h-4 w-4 mr-1" aria-hidden />
                    {t("devices.rename")}
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmRotate(d)}>
                    <KeyRound className="h-4 w-4 mr-1" aria-hidden />
                    {d.hasKey ? t("devices.rotateKey") : t("devices.issueKey")}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void toggleActive(d)}>
                    {d.isActive ? t("devices.deactivate") : t("devices.activate")}
                  </Button>
                </div>
              )}
            </div>

            {d.syncRuns.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-medium text-muted-foreground mb-1">{t("devices.recentSyncs")}</h4>
                <div className="overflow-x-auto rounded-lg border border-border">
                <AppDataTable className="text-xs">
                  <AppDataTableHead sticky={false} dense>
                    <tr>
                      <th>{t("devices.syncAt")}</th>
                      <th className="text-right">{t("devices.received")}</th>
                      <th className="text-right">{t("devices.inserted")}</th>
                      <th className="text-right">{t("devices.duplicates")}</th>
                      <th className="text-right">{t("devices.newBadges")}</th>
                    </tr>
                  </AppDataTableHead>
                  <AppDataTableBody>
                    {d.syncRuns.map((r) => (
                      <tr key={r.id}>
                        <td className="px-2 py-1">{formatDateTime(r.createdAt, TZ, locale)}</td>
                        <td className="px-2 py-1 text-right">{r.received}</td>
                        <td className="px-2 py-1 text-right">{r.inserted}</td>
                        <td className="px-2 py-1 text-right">{r.duplicates}</td>
                        <td className="px-2 py-1 text-right">{r.newBadges}</td>
                      </tr>
                    ))}
                  </AppDataTableBody>
                </AppDataTable>
                </div>
              </div>
            )}
          </GlassCard>
        ))
      )}
      </PendingFade>

      <GlassDialog open={creating} onOpenChange={setCreating} title={t("devices.addTitle", { branch: `${branch.code} ${branch.name}` })} solid>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) void create()
          }}
        >
          <label htmlFor="device-name" className="block text-sm font-medium text-foreground">
            {t("devices.name")}
          </label>
          <input
            id="device-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder={t("devices.namePlaceholder")}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreating(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {t("devices.create")}
            </Button>
          </div>
        </form>
      </GlassDialog>

      <GlassDialog open={renaming != null} onOpenChange={(o) => !o && setRenaming(null)} title={t("devices.renameTitle")} solid>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void saveRename()
          }}
        >
          <label htmlFor="device-rename" className="block text-sm font-medium text-foreground">
            {t("devices.name")}
          </label>
          <input
            id="device-rename"
            autoFocus
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            maxLength={100}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRenaming(null)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={busy || !renameName.trim() || renameName.trim() === renaming?.name}>
              {t("devices.renameSave")}
            </Button>
          </div>
        </form>
      </GlassDialog>

      <GlassDialog open={confirmRotate != null} onOpenChange={(o) => !o && setConfirmRotate(null)} title={t("devices.rotateTitle")} solid>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("devices.rotateWarning", { device: confirmRotate?.name ?? "" })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmRotate(null)}>
              {t("cancel")}
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => confirmRotate && void rotate(confirmRotate)}>
              {t("devices.rotateConfirm")}
            </Button>
          </div>
        </div>
      </GlassDialog>

      <GlassDialog open={issuedKey != null} onOpenChange={(o) => !o && setIssuedKey(null)} title={t("devices.keyTitle", { device: issuedKey?.deviceName ?? "" })} solid>
        <IssuedKey value={issuedKey?.key ?? ""} onDone={() => setIssuedKey(null)} />
      </GlassDialog>
    </div>
  )
}

function IssuedKey({ value, onDone }: { value: string; onDone: () => void }) {
  const t = useTranslations("attendance")
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-3">
      <p className="text-sm text-amber-700 dark:text-amber-300">{t("devices.keyOnce")}</p>
      <div className="flex gap-2">
        <input readOnly value={value} onFocus={(e) => e.target.select()} aria-label="API key" className="flex-1 font-mono text-xs border border-border rounded-lg px-3 py-2 bg-muted" />
        <Button
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(value)
            setCopied(true)
          }}
        >
          <Copy className="h-4 w-4 mr-1" aria-hidden />
          {copied ? t("devices.copied") : t("devices.copy")}
        </Button>
      </div>
      <div className="flex justify-end">
        <Button onClick={onDone}>{t("devices.done")}</Button>
      </div>
    </div>
  )
}
