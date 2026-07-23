import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { getJobById } from "@/modules/transport"
import { JobStatusBadge } from "@/components/transport/job-status-badge"
import { StopTimeline } from "@/components/transport/stop-timeline"
import { JobAttachmentGallery } from "@/components/transport/job-attachment-gallery"
import { CompleteJobButton } from "@/components/transport/complete-job-button"
import { AssignJobForm } from "@/components/transport/assign-job-form"
import Link from "next/link"
import { ArrowLeft, Pencil, Printer } from "lucide-react"

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

    return (
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/transport/jobs" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="h-4 w-4" /> กลับ
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-slate-900">{job.jobNumber}</h1>
              <JobStatusBadge status={job.status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              ประเภท: {job.jobType}{job.cargoType ? ` · สินค้า: ${job.cargoType}` : ""} · ความสำคัญ: {PRIORITY_LABEL[job.priority] ?? job.priority}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CompleteJobButton jobId={id} jobStatus={job.status} />
            <Link
              href={`/transport/jobs/${id}/print`}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" /> พิมพ์
            </Link>
            {job.status !== "cancelled" && (
              <Link
                href={`/transport/jobs/${id}/edit`}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="h-4 w-4" /> แก้ไข
              </Link>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Job info + Assignment */}
          <div className="space-y-4 lg:col-span-1">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">ข้อมูลลูกค้า</h3>
              <div className="space-y-2 text-sm text-slate-600">
                <div><span className="font-medium text-slate-700">ลูกค้า:</span> {job.customerName ?? job.customer?.name ?? "—"}</div>
                {job.customer?.phone && <div><span className="font-medium text-slate-700">โทร:</span> {job.customer.phone}</div>}
                <div><span className="font-medium text-slate-700">สาขา:</span> {job.branch.name}</div>
                {job.estimatedWeightKg && (
                  <div><span className="font-medium text-slate-700">น้ำหนัก:</span> {Number(job.estimatedWeightKg).toLocaleString()} กก.</div>
                )}
              </div>
            </div>

            {/* Assignment — interactive form */}
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

            {job.notes && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="mb-2 text-sm font-semibold text-slate-700">หมายเหตุ</h3>
                <p className="text-sm text-slate-600">{job.notes}</p>
              </div>
            )}
          </div>

          {/* Right: Stops + Gallery */}
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-slate-700">จุดแวะ ({job.stops.length} จุด)</h3>
              <StopTimeline stops={job.stops} />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-slate-700">ไฟล์แนบ / รูปภาพ</h3>
              <JobAttachmentGallery attachments={job.attachments} />
            </div>
          </div>
        </div>
      </div>
    )
  } catch {
    notFound()
  }
}
