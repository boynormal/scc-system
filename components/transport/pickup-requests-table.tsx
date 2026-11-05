"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Inbox } from "lucide-react"
import { AppDataTable, AppDataTableBody, AppDataTableHead, AppDataTablePanel } from "@/components/shell/app-data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { GlassDialog } from "@/components/glass"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"
import type { PickupDisplayStatus } from "@/modules/transport/application/pickup-request-rules"
import type { PickupRequestDto } from "@/modules/transport/application/pickup-request-service"

const STATUS_VARIANT: Record<PickupDisplayStatus, "warning" | "info" | "success" | "default"> = {
  waiting: "warning",
  requeue: "warning",
  scheduled: "info",
  in_progress: "info",
  picked: "success",
  cancelled: "default",
}

type AttachableJob = {
  id: string
  jobNumber: string
  running: boolean
  scheduledDate: string | null
  customerName: string | null
  branchName: string
  stopCount: number
  plateNumber: string | null
  driverName: string | null
}

function formatDate(iso: string | null, withTime = false) {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" as const } : {}),
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso))
}

function isQueued(status: PickupDisplayStatus) {
  return status === "waiting" || status === "requeue"
}

function AttachDialog({
  request,
  onClose,
}: {
  request: PickupRequestDto | null
  onClose: (attached: boolean) => void
}) {
  const t = useTranslations("pickup")
  const [jobs, setJobs] = useState<AttachableJob[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestId = request?.id ?? null

  useEffect(() => {
    if (!requestId) return
    setError(null)
    void load()
    // Reload the job list each time the dialog opens for a request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId])

  async function load() {
    setJobs(null)
    setLoadError(null)
    try {
      const res = await fetchJson<{ data: AttachableJob[] }>("/api/transport/pickup-requests/attachable-jobs")
      setJobs(res.data)
    } catch (err) {
      setLoadError(err instanceof ClientFetchError ? err.message : t("loadFailed"))
    }
  }

  async function attach(jobId: string) {
    if (!request) return
    setSavingId(jobId)
    setError(null)
    try {
      await fetchJson(`/api/transport/pickup-requests/${request.id}/attach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      })
      onClose(true)
    } catch (err) {
      setError(err instanceof ClientFetchError ? err.message : t("saveFailed"))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <GlassDialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) onClose(false)
      }}
      title={request ? t("attachTitle", { no: request.requestNo }) : ""}
      solid
      className="max-w-2xl"
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("attachHint")}</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {loadError ? (
          <div className="space-y-2">
            <p className="text-sm text-red-600">{loadError}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
              {t("retry")}
            </Button>
          </div>
        ) : jobs === null ? (
          <p className="text-sm text-foreground">…</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-foreground">{t("attachEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {jobs.map((job) => (
              <li key={job.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 text-sm text-foreground">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      {job.jobNumber}
                      {job.running && <Badge variant="warning">{t("attachRunning")}</Badge>}
                    </div>
                    <div>
                      {formatDate(job.scheduledDate)} · {job.branchName} · {t("stops")} {job.stopCount}
                    </div>
                    <div>
                      {[job.customerName, job.plateNumber, job.driverName].filter(Boolean).join(" · ") || "—"}
                    </div>
                    {job.running && <div className="mt-1 text-xs text-amber-700">{t("attachRunningHint")}</div>}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    loading={savingId === job.id}
                    disabled={savingId !== null}
                    onClick={() => void attach(job.id)}
                  >
                    {t("attachConfirm")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </GlassDialog>
  )
}

export function PickupRequestsTable({ rows, canWrite }: { rows: PickupRequestDto[]; canWrite: boolean }) {
  const t = useTranslations("pickup")
  const router = useRouter()
  const [attachFor, setAttachFor] = useState<PickupRequestDto | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  async function cancel(row: PickupRequestDto) {
    if (!window.confirm(t("cancelConfirm", { no: row.requestNo }))) return
    setCancellingId(row.id)
    try {
      await fetchJson(`/api/transport/pickup-requests/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      })
      router.refresh()
    } catch (err) {
      window.alert(err instanceof ClientFetchError ? err.message : t("saveFailed"))
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <AppDataTablePanel>
      {rows.length === 0 ? (
        <EmptyState icon={Inbox} title={t("listEmpty")} />
      ) : (
        <AppDataTable>
          <AppDataTableHead>
            <tr>
              <th className="px-4 py-3 text-left">{t("queueNo")}</th>
              <th className="px-4 py-3 text-left">{t("customer")}</th>
              <th className="px-4 py-3 text-left">{t("items")}</th>
              <th className="hidden px-4 py-3 text-left xl:table-cell">{t("requestedAt")}</th>
              <th className="px-4 py-3 text-left">{t("plannedAt")}</th>
              <th className="hidden px-4 py-3 text-left xl:table-cell">{t("pickedAt")}</th>
              <th className="px-4 py-3 text-left">{t("status")}</th>
              <th className="px-4 py-3 text-right">{t("actions")}</th>
            </tr>
          </AppDataTableHead>
          <AppDataTableBody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-semibold text-foreground">#{row.requestNo}</td>
                <td className="px-4 py-3 text-foreground">
                  <div className="font-medium">{row.customer.name}</div>
                  <div className="text-xs">
                    {[row.contactName ?? row.customer.contactName, row.phone ?? row.customer.phone]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </td>
                <td className="px-4 py-3 text-foreground">
                  <ul className="space-y-0.5">
                    {row.lines.map((line) => (
                      <li key={line.id}>{line.label}</li>
                    ))}
                  </ul>
                  {row.note && <div className="mt-1 text-xs">{row.note}</div>}
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-foreground xl:table-cell">
                  {formatDate(row.createdAt, true)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-foreground">{formatDate(row.plannedAt)}</td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-foreground xl:table-cell">
                  {formatDate(row.pickedAt, true)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <Badge variant={STATUS_VARIANT[row.displayStatus]}>{t(`status_${row.displayStatus}`)}</Badge>
                    {row.job && (
                      <Link href={`/transport/jobs/${row.job.id}`} className="text-xs font-medium text-cyan-700 hover:underline">
                        {row.job.jobNumber}
                      </Link>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {canWrite && isQueued(row.displayStatus) && (
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link
                        href={`/transport/jobs/new?pickupRequest=${row.id}`}
                        className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        {t("createJob")}
                      </Link>
                      <Button type="button" size="sm" variant="outline" onClick={() => setAttachFor(row)}>
                        {t("attachJob")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        loading={cancellingId === row.id}
                        onClick={() => void cancel(row)}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </AppDataTableBody>
        </AppDataTable>
      )}
      <AttachDialog
        request={attachFor}
        onClose={(attached) => {
          setAttachFor(null)
          if (attached) router.refresh()
        }}
      />
    </AppDataTablePanel>
  )
}
