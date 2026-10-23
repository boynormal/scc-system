"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Clock, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Input } from "@/components/ui/input"
import { LoadingState } from "@/components/ui/loading-state"
import { Select } from "@/components/ui/select"
import { GlassDialog } from "@/components/glass"
import { ClientFetchError, fetchJson } from "@/lib/client-fetch"
import {
  HOLD_REASON_LABEL,
  HOLD_REASONS,
  type HoldReason,
} from "@/modules/work_orders/application/work-order-transitions"

type EntryType = "work" | "wait" | "travel"

type Technician = {
  userId: string
  name: string
  isAssignee: boolean
  removable: boolean
  openOnThis: { id: string; entryType: EntryType; waitReason: string | null; startedAt: string } | null
  openElsewhere: { workOrderId: string; woNumber: string } | null
}

type Entry = {
  id: string
  userId: string
  userName: string
  entryType: EntryType
  startedAt: string
  endedAt: string | null
  waitReason: string | null
  note: string | null
  editReason: string | null
}

type Summary = { userId: string; workMinutes: number; waitMinutes: number; travelMinutes: number }

type LaborView = {
  status: string
  technicians: Technician[]
  entries: Entry[]
  summary: Summary[]
}

type UserOption = { id: string; firstName: string; lastName: string }

const STARTABLE = new Set(["assigned", "in_progress", "on_hold"])
const TERMINAL = new Set(["completed", "closed", "cancelled"])

function messageOf(error: unknown) {
  return error instanceof ClientFetchError ? error.message : "เกิดข้อผิดพลาด"
}

function toLocalInput(iso: string) {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toIso(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function WorkOrderLaborPanel(props: { workOrderId: string; canUpdate: boolean }) {
  const t = useTranslations("workOrderLabor")
  const router = useRouter()
  const [view, setView] = useState<LaborView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [users, setUsers] = useState<UserOption[]>([])
  const [dialog, setDialog] = useState<
    | { kind: "add" }
    | { kind: "pause"; userId: string }
    | { kind: "manual" }
    | { kind: "edit"; entry: Entry }
    | null
  >(null)
  const [userId, setUserId] = useState("")
  const [waitReason, setWaitReason] = useState("")
  const [entryType, setEntryType] = useState<EntryType>("work")
  const [startedAt, setStartedAt] = useState("")
  const [endedAt, setEndedAt] = useState("")
  const [reason, setReason] = useState("")
  const [note, setNote] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const json = await fetchJson<{ data: LaborView }>(`/api/work-orders/${props.workOrderId}/labor`)
      setView(json.data)
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setLoading(false)
    }
  }, [props.workOrderId])

  useEffect(() => {
    void load()
  }, [load])

  function formatMinutes(total: number) {
    const minutes = Math.max(0, total)
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    if (hours === 0) return t("minutesOnly", { minutes: rest })
    return t("hoursMinutes", { hours, minutes: rest })
  }

  function typeLabel(type: EntryType) {
    if (type === "wait") return t("wait")
    if (type === "travel") return t("travel")
    return t("work")
  }

  function closeDialog() {
    setDialog(null)
    setFormError(null)
    setReason("")
    setNote("")
    setWaitReason("")
    setUserId("")
  }

  async function run(task: () => Promise<void>) {
    setPending(true)
    setFormError(null)
    setNotice(null)
    try {
      await task()
      closeDialog()
      await load()
      router.refresh()
    } catch (err) {
      const message = messageOf(err)
      if (dialog) setFormError(message)
      else setNotice(message)
    } finally {
      setPending(false)
    }
  }

  async function postAction(body: Record<string, unknown>) {
    const json = await fetchJson<{ data: { autoClosed: { woNumber: string } | null } }>(
      `/api/work-orders/${props.workOrderId}/labor`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    )
    if (json.data.autoClosed) setNotice(t("autoClosed", { wo: json.data.autoClosed.woNumber }))
  }

  async function loadUsers() {
    if (users.length > 0) return
    const json = await fetchJson<{ data: UserOption[] }>("/api/users?page=1&pageSize=100")
    setUsers(json.data ?? [])
  }

  const terminal = view ? TERMINAL.has(view.status) : false
  const startable = view ? STARTABLE.has(view.status) : false

  return (
    <section className="space-y-4 rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground">{t("title")}</h2>
        {props.canUpdate && !terminal && (
          <Button type="button" size="sm" variant="outline" onClick={() => void loadUsers().then(() => setDialog({ kind: "add" })).catch((err) => setNotice(messageOf(err)))}>
            {t("addTechnician")}
          </Button>
        )}
      </div>
      {notice && <p className="text-sm text-foreground">{notice}</p>}
      {loading && <LoadingState className="py-8" />}
      {!loading && error && <ErrorState description={error} onRetry={() => { setLoading(true); void load() }} className="py-8" />}
      {!loading && !error && view && (
        <>
          {view.technicians.length === 0 ? (
            <EmptyState icon={Users} title={t("noTechnicians")} description={t("noTechniciansHint")} className="py-8" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-foreground">
                <thead>
                  <tr className="border-b border-border text-foreground">
                    <th className="py-2 pr-3 font-medium">{t("person")}</th>
                    <th className="py-2 pr-3 font-medium">{t("workHours")}</th>
                    <th className="py-2 pr-3 font-medium">{t("waitHours")}</th>
                    <th className="py-2 pr-3 font-medium">{t("travelHours")}</th>
                    <th className="py-2 font-medium">{t("title")}</th>
                  </tr>
                </thead>
                <tbody>
                  {view.technicians.map((person) => {
                    const totals = view.summary.find((row) => row.userId === person.userId)
                    const open = person.openOnThis
                    return (
                      <tr key={person.userId} className="border-b border-border align-top">
                        <td className="py-2 pr-3">
                          <p>{person.name}</p>
                          {person.isAssignee && <p className="text-xs text-muted-foreground">{t("assignee")}</p>}
                          <p className="text-xs text-muted-foreground">
                            {open?.entryType === "work" && t("working")}
                            {open?.entryType === "travel" && t("traveling")}
                            {open?.entryType === "wait" && `${t("waiting")}${open.waitReason ? ` · ${HOLD_REASON_LABEL[open.waitReason as HoldReason] ?? open.waitReason}` : ""}`}
                            {!open && person.openElsewhere && t("otherWork", { wo: person.openElsewhere.woNumber })}
                            {!open && !person.openElsewhere && t("idle")}
                          </p>
                        </td>
                        <td className="py-2 pr-3">{formatMinutes(totals?.workMinutes ?? 0)}</td>
                        <td className="py-2 pr-3">{formatMinutes(totals?.waitMinutes ?? 0)}</td>
                        <td className="py-2 pr-3">{formatMinutes(totals?.travelMinutes ?? 0)}</td>
                        <td className="py-2">
                          {props.canUpdate && !terminal && (
                            <div className="flex flex-wrap gap-1">
                              {!open && startable && (
                                <>
                                  <Button type="button" size="sm" disabled={pending} onClick={() => void run(() => postAction({ mode: "action", action: "start", userId: person.userId, entryType: "work" }))}>
                                    {t("startWork")}
                                  </Button>
                                  <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void run(() => postAction({ mode: "action", action: "start", userId: person.userId, entryType: "travel" }))}>
                                    {t("startTravel")}
                                  </Button>
                                </>
                              )}
                              {open && open.entryType !== "wait" && (
                                <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setDialog({ kind: "pause", userId: person.userId })}>
                                  {t("pause")}
                                </Button>
                              )}
                              {open?.entryType === "wait" && (
                                <Button type="button" size="sm" disabled={pending} onClick={() => void run(() => postAction({ mode: "action", action: "resume", userId: person.userId }))}>
                                  {t("resume")}
                                </Button>
                              )}
                              {open && (
                                <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void run(() => postAction({ mode: "action", action: "finish", userId: person.userId }))}>
                                  {t("finish")}
                                </Button>
                              )}
                              {person.removable && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={pending}
                                  onClick={() => void run(async () => {
                                    await fetchJson(`/api/work-orders/${props.workOrderId}/technicians/${person.userId}`, { method: "DELETE" })
                                  })}
                                >
                                  {t("remove")}
                                </Button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-foreground">{t("history")}</h3>
            {props.canUpdate && !terminal && view.technicians.length > 0 && (
              <Button type="button" size="sm" variant="outline" onClick={() => {
                setStartedAt("")
                setEndedAt("")
                setReason("")
                setNote("")
                setUserId("")
                setEntryType("work")
                setWaitReason("")
                setDialog({ kind: "manual" })
              }}>
                {t("addManual")}
              </Button>
            )}
          </div>
          {view.entries.length === 0 ? (
            <EmptyState icon={Clock} title={t("noEntries")} className="py-6" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-foreground">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-medium">{t("person")}</th>
                    <th className="py-2 pr-3 font-medium">{t("entryType")}</th>
                    <th className="py-2 pr-3 font-medium">{t("startedAt")}</th>
                    <th className="py-2 pr-3 font-medium">{t("endedAt")}</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {view.entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-border align-top">
                      <td className="py-2 pr-3">{entry.userName}</td>
                      <td className="py-2 pr-3">
                        {typeLabel(entry.entryType)}
                        {entry.waitReason ? ` · ${HOLD_REASON_LABEL[entry.waitReason as HoldReason] ?? entry.waitReason}` : ""}
                        {entry.editReason && <p className="text-xs text-muted-foreground">{t("edited")}: {entry.editReason}</p>}
                      </td>
                      <td className="py-2 pr-3">{formatWhen(entry.startedAt)}</td>
                      <td className="py-2 pr-3">{entry.endedAt ? formatWhen(entry.endedAt) : t("open")}</td>
                      <td className="py-2">
                        {props.canUpdate && !terminal && entry.endedAt && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setStartedAt(toLocalInput(entry.startedAt))
                              setEndedAt(toLocalInput(entry.endedAt as string))
                              setNote(entry.note ?? "")
                              setReason("")
                              setDialog({ kind: "edit", entry })
                            }}
                          >
                            {t("editEntry")}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <GlassDialog open={dialog?.kind === "add"} onOpenChange={(open) => !open && closeDialog()} title={t("addTechnician")} solid>
        <div className="space-y-3">
          <Select
            label={t("selectUser")}
            placeholder={t("selectUser")}
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            options={users.map((user) => ({ value: user.id, label: `${user.firstName} ${user.lastName}` }))}
          />
          {formError && <p className="text-sm text-foreground">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeDialog}>{t("cancel")}</Button>
            <Button
              type="button"
              disabled={pending || !userId}
              onClick={() => void run(async () => {
                await fetchJson(`/api/work-orders/${props.workOrderId}/technicians`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId }),
                })
              })}
            >
              {t("save")}
            </Button>
          </div>
        </div>
      </GlassDialog>

      <GlassDialog open={dialog?.kind === "pause"} onOpenChange={(open) => !open && closeDialog()} title={t("pause")} solid>
        <div className="space-y-3">
          <Select
            label={t("waitReason")}
            placeholder={t("waitReason")}
            value={waitReason}
            onChange={(event) => setWaitReason(event.target.value)}
            options={HOLD_REASONS.map((item) => ({ value: item, label: HOLD_REASON_LABEL[item] }))}
          />
          {formError && <p className="text-sm text-foreground">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeDialog}>{t("cancel")}</Button>
            <Button
              type="button"
              disabled={pending || !waitReason || dialog?.kind !== "pause"}
              onClick={() => {
                if (dialog?.kind !== "pause") return
                void run(() => postAction({ mode: "action", action: "pause", userId: dialog.userId, waitReason }))
              }}
            >
              {t("save")}
            </Button>
          </div>
        </div>
      </GlassDialog>

      <GlassDialog open={dialog?.kind === "manual" || dialog?.kind === "edit"} onOpenChange={(open) => !open && closeDialog()} title={dialog?.kind === "edit" ? t("editEntry") : t("addManual")} solid>
        <div className="space-y-3">
          {dialog?.kind === "manual" && (
            <>
              <Select
                label={t("person")}
                placeholder={t("selectUser")}
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                options={(view?.technicians ?? []).map((person) => ({ value: person.userId, label: person.name }))}
              />
              <Select
                label={t("entryType")}
                value={entryType}
                onChange={(event) => setEntryType(event.target.value as EntryType)}
                options={[
                  { value: "work", label: t("work") },
                  { value: "wait", label: t("wait") },
                  { value: "travel", label: t("travel") },
                ]}
              />
              {entryType === "wait" && (
                <Select
                  label={t("waitReason")}
                  placeholder={t("waitReason")}
                  value={waitReason}
                  onChange={(event) => setWaitReason(event.target.value)}
                  options={HOLD_REASONS.map((item) => ({ value: item, label: HOLD_REASON_LABEL[item] }))}
                />
              )}
            </>
          )}
          <Input label={t("startedAt")} type="datetime-local" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} />
          <Input label={t("endedAt")} type="datetime-local" value={endedAt} onChange={(event) => setEndedAt(event.target.value)} />
          <Input label={t("reason")} value={reason} hint={t("reasonHint")} onChange={(event) => setReason(event.target.value)} required />
          <Input label={t("note")} value={note} onChange={(event) => setNote(event.target.value)} />
          {formError && <p className="text-sm text-foreground">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeDialog}>{t("cancel")}</Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => void run(async () => {
                const start = toIso(startedAt)
                const end = toIso(endedAt)
                if (!start || !end) throw new ClientFetchError("เวลาไม่ถูกต้อง")
                if (dialog?.kind === "edit") {
                  await fetchJson(`/api/work-orders/${props.workOrderId}/labor/${dialog.entry.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ startedAt: start, endedAt: end, reason, note }),
                  })
                  return
                }
                await fetchJson(`/api/work-orders/${props.workOrderId}/labor`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    mode: "manual",
                    userId,
                    entryType,
                    startedAt: start,
                    endedAt: end,
                    waitReason: entryType === "wait" ? waitReason : undefined,
                    reason,
                    note: note || undefined,
                  }),
                })
              })}
            >
              {t("save")}
            </Button>
          </div>
        </div>
      </GlassDialog>
    </section>
  )
}
