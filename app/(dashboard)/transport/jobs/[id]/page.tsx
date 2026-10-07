import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { getJobById, getJobPunchView, listJobHistory } from "@/modules/transport"
import { describeLegFlag } from "@/modules/transport/application/job-punch-rules"
import { JobStatusBadge } from "@/components/transport/job-status-badge"
import { AssignJobForm } from "@/components/transport/assign-job-form"
import { CompleteJobButton } from "@/components/transport/complete-job-button"
import { CancelJobButton } from "@/components/transport/cancel-job-button"
import { ReopenJobButton } from "@/components/transport/reopen-job-button"
import Link from "next/link"
import { ArrowLeft, ClipboardCheck, Pencil, Printer } from "lucide-react"

const PRIORITY_LABEL: Record<string, string> = { low: "ต่ำ", normal: "ปกติ", high: "สูง", urgent: "ด่วน" }

export default async function TransportJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { id } = await params
  const roles = session.user.roles as UserRole[]

  try {
    const job = await getJobById(prisma, {
      id,
      companyId: session.user.companyId as string,
      roles,
    })
    const punchView = await getJobPunchView(prisma, {
      id,
      companyId: session.user.companyId as string,
      userId: session.user.id as string,
      roles,
    }).catch(() => null)
    const history = await listJobHistory(prisma, id)
    const flow = buildFlow(job, punchView)

    return (
      <div className="min-w-0 space-y-4 p-4 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/transport/jobs" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> กลับ
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">{job.jobNumber}</h1>
              <JobStatusBadge status={job.status} />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              href={`/transport/jobs/${id}/log`}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/60"
            >
              <ClipboardCheck className="h-4 w-4" /> บันทึกเวลา
            </Link>
            <Link
              href={`/transport/jobs/${id}/print`}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/60"
            >
              <Printer className="h-4 w-4" /> พิมพ์
            </Link>
            {job.status !== "completed" && job.status !== "cancelled" && (
              <>
                <Link
                  href={`/transport/jobs/${id}/edit`}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/60"
                >
                  <Pencil className="h-4 w-4" /> แก้ไข
                </Link>
                <CompleteJobButton jobId={id} jobStatus={job.status} />
                <CancelJobButton jobId={id} jobStatus={job.status} />
              </>
            )}
            {(job.status === "completed" || job.status === "cancelled") && (
              <ReopenJobButton jobId={id} jobStatus={job.status} />
            )}
          </div>
        </div>

        <section className="space-y-6 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">สถานะขนส่ง</h2>
                <p className="mt-1 text-sm text-muted-foreground">{flow.summary}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {flow.chips.map((chip) => (
                  <span key={chip.label} className="rounded-full border border-border bg-muted/50 px-3 py-1 text-muted-foreground">
                    <span className="font-medium text-foreground">{chip.label}</span> {chip.value}
                  </span>
                ))}
              </div>
            </div>
            <ol className="flex items-stretch gap-3 overflow-x-auto pb-1">
              {flow.steps.map((step) => (
                <li
                  key={step.key}
                  className={`flex min-w-[15rem] flex-1 flex-col rounded-lg border p-3 ${
                    step.here
                      ? "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-200 dark:bg-cyan-950/40 dark:ring-cyan-900"
                      : "border-border bg-muted/30"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${step.done ? "bg-cyan-600" : "bg-muted-foreground/30"}`} />
                      <p className="text-sm font-semibold text-foreground">{step.title}</p>
                    </div>
                    {step.here && step.hereLabel ? (
                      <span className="rounded-full bg-cyan-600 px-2 py-0.5 text-[11px] font-medium text-white">
                        {step.hereLabel}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-foreground">{step.place}</p>
                  {step.address ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{step.address}</p> : null}
                  <dl className="mt-2 space-y-1">
                    {step.facts.map((fact) => (
                      <div key={fact.label} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{fact.label}</span> {fact.value}
                      </div>
                    ))}
                  </dl>
                  {step.warning ? <p className="mt-2 text-xs font-medium text-red-600">{step.warning}</p> : null}
                </li>
              ))}
            </ol>
          </div>

          <div className="grid items-start gap-6 border-t border-border pt-6 lg:grid-cols-2">
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-foreground">ข้อมูล</h2>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div><span className="font-medium text-foreground">ลูกค้า:</span> {job.customerName ?? job.customer?.name ?? "—"}</div>
                {job.customer?.phone ? <div><span className="font-medium text-foreground">โทร:</span> {job.customer.phone}</div> : null}
                <div><span className="font-medium text-foreground">สาขา:</span> {job.branch.name}</div>
                <div><span className="font-medium text-foreground">ประเภท:</span> {job.jobType}{job.cargoType ? ` · ${job.cargoType}` : ""}</div>
                <div><span className="font-medium text-foreground">ความสำคัญ:</span> {PRIORITY_LABEL[job.priority] ?? job.priority}</div>
                {job.estimatedWeightKg ? (
                  <div><span className="font-medium text-foreground">น้ำหนัก:</span> {Number(job.estimatedWeightKg).toLocaleString()} กก.</div>
                ) : null}
                {job.notes ? <div><span className="font-medium text-foreground">หมายเหตุ:</span> {job.notes}</div> : null}
              </div>
              <AssignJobForm
                jobId={id}
                branchId={job.branchId}
                jobStatus={job.status}
                currentAssignment={
                  job.assignment
                    ? {
                        vehicle: {
                          id: job.assignment.vehicle.id,
                          plateNumber: job.assignment.vehicle.plateNumber,
                          name: job.assignment.vehicle.name,
                          vehicleType: job.assignment.vehicle.vehicleType,
                        },
                        driver: {
                          id: job.assignment.driver.id,
                          firstName: job.assignment.driver.firstName,
                          lastName: job.assignment.driver.lastName,
                          phone: job.assignment.driver.phone ?? null,
                        },
                        assignedByUser: {
                          firstName: job.assignment.assignedByUser.firstName,
                          lastName: job.assignment.assignedByUser.lastName,
                        },
                        assignedAt: job.assignment.assignedAt?.toISOString?.() ?? "",
                      }
                    : null
                }
              />
            </div>
            <div>
              <h2 className="mb-3 text-base font-semibold text-foreground">ประวัติ</h2>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">ยังไม่มีประวัติ</p>
              ) : (
                <ol className="space-y-3">
                  {history.map((item) => (
                    <li key={item.id} className="text-sm">
                      <p className="font-medium text-foreground">{item.summary || item.event}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.actor} · {new Date(item.at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </section>
      </div>
    )
  } catch {
    notFound()
  }
}

function when(value: Date | string | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })
}

function kmText(km: number | null | undefined) {
  return km != null ? `${km.toLocaleString()} กม.` : "—"
}

function buildFlow(
  job: {
    branch: { name: string }
    customerName: string | null
    customer: { name: string } | null
    stops: { id: string; customerName: string; address?: string | null; status: string }[]
  },
  punchView: {
    vehiclePlate: string | null
    driverName: string | null
    stops: { id: string; customerName: string; address?: string | null; status: string }[]
    punches: { stopId: string | null; kind: string; recordedAt: Date | string; odometerKm: number | null }[]
    legs: {
      fromKind: string
      toKind: string
      toStopId: string | null
      fromStopId: string | null
      kind: string
      minutes: number
      km: number | null
      flag: "long_dwell" | "slow_travel" | null
    }[]
  } | null
) {
  const stops = (punchView?.stops ?? job.stops).filter(
    (stop) => stop.status !== "skipped" && stop.status !== "cancelled"
  )
  const punches = punchView?.punches ?? []
  const legs = punchView?.legs ?? []
  const latest = [...punches].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
  )[0]
  const hereKey =
    latest?.kind === "start"
      ? "start"
      : latest?.kind === "finish"
        ? "finish"
        : latest?.stopId ?? null
  const hereLabel =
    latest?.kind === "finish"
      ? "ถึงจุดสิ้นสุดแล้ว"
      : latest?.kind === "depart"
        ? "ออกล่าสุดจากจุดนี้"
        : latest
          ? "อยู่ที่นี่"
          : null
  const punchAt = (kind: string, stopId?: string | null) =>
    punches.find((punch) => punch.kind === kind && (stopId === undefined || punch.stopId === stopId))
  const travelTo = (toKind: string, toStopId?: string | null) =>
    legs.find((leg) => leg.kind === "travel" && leg.toKind === toKind && (toStopId === undefined || leg.toStopId === toStopId))
  const dwellAt = (stopId: string) => legs.find((leg) => leg.kind === "dwell" && leg.fromStopId === stopId)

  const steps = [
    {
      key: "start",
      title: "ต้นทาง",
      place: job.branch.name,
      address: null as string | null,
      done: Boolean(punchAt("start")),
      here: hereKey === "start",
      hereLabel,
      facts: [
        { label: "เริ่มงาน", value: when(punchAt("start")?.recordedAt) },
        { label: "เลขไมล์", value: kmText(punchAt("start")?.odometerKm) },
      ],
      warning: null as string | null,
    },
    ...stops.map((stop, index) => {
      const arrive = punchAt("arrive", stop.id)
      const depart = punchAt("depart", stop.id)
      const dwell = dwellAt(stop.id)
      const inbound = travelTo("arrive", stop.id) ?? travelTo("depart", stop.id)
      return {
        key: stop.id,
        title: `จุดที่ ${index + 1}`,
        place: stop.customerName,
        address: stop.address ?? null,
        done: Boolean(arrive || depart),
        here: hereKey === stop.id,
        hereLabel,
        facts: [
          { label: "ถึง", value: when(arrive?.recordedAt) },
          { label: "ออก", value: when(depart?.recordedAt) },
          { label: "จอด", value: dwell ? `${dwell.minutes} นาที` : "—" },
          { label: "เดินทางมา", value: inbound ? `${inbound.minutes} นาที · ${kmText(inbound.km)}` : "—" },
          { label: "เลขไมล์", value: kmText(depart?.odometerKm ?? arrive?.odometerKm) },
        ],
        warning: dwell ? describeLegFlag(dwell) : inbound ? describeLegFlag(inbound) : null,
      }
    }),
    {
      key: "finish",
      title: "สิ้นสุด",
      place: job.customerName ?? job.customer?.name ?? "จบงาน",
      address: null as string | null,
      done: Boolean(punchAt("finish")),
      here: hereKey === "finish",
      hereLabel,
      facts: [
        { label: "จบงาน", value: when(punchAt("finish")?.recordedAt) },
        { label: "เลขไมล์", value: kmText(punchAt("finish")?.odometerKm) },
        {
          label: "เดินทางมา",
          value: (() => {
            const leg = travelTo("finish")
            return leg ? `${leg.minutes} นาที · ${kmText(leg.km)}` : "—"
          })(),
        },
      ],
      warning: describeLegFlag(travelTo("finish") ?? { flag: null, minutes: 0, km: null }),
    },
  ]

  const travel = legs.filter((leg) => leg.kind === "travel")
  const totalMinutes = travel.reduce((sum, leg) => sum + leg.minutes, 0)
  const totalKm = travel.reduce((sum, leg) => sum + (leg.km ?? 0), 0)
  const hasKm = travel.some((leg) => leg.km != null)

  const hereStep = steps.find((step) => step.here)
  return {
    summary: hereStep
      ? `${hereStep.hereLabel} · ${hereStep.place}${hasKm ? ` · รวม ${totalMinutes.toLocaleString()} นาที ${totalKm.toLocaleString()} กม.` : ""}`
      : hasKm
      ? `เดินทางรวม ${totalMinutes.toLocaleString()} นาที · ${totalKm.toLocaleString()} กม.`
      : travel.length
        ? `เดินทางรวม ${totalMinutes.toLocaleString()} นาที`
        : "ยังไม่มีการบันทึกเวลา",
    chips: [
      { label: "รถ", value: punchView?.vehiclePlate ?? "—" },
      { label: "คนขับ", value: punchView?.driverName ?? "—" },
      { label: "จุดส่ง", value: `${stops.length} จุด` },
    ],
    steps,
  }
}
