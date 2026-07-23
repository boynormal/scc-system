import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { getJobById } from "@/modules/transport"
import { JobPrintView } from "@/components/transport/job-print-view"

export const metadata = { title: "พิมพ์ใบงานขนส่ง" }

export default async function TransportJobPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string>>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { id } = await params
  const sp = await searchParams
  const autoPrint = sp.auto === "1"

  try {
    const job = await getJobById(prisma, {
      id,
      companyId: session.user.companyId as string,
      roles: session.user.roles as UserRole[],
    })

    return (
      <JobPrintView
        autoPrint={autoPrint}
        job={{
          jobNumber: job.jobNumber,
          status: job.status,
          jobType: job.jobType,
          cargoType: job.cargoType,
          priority: job.priority,
          customerName: job.customerName ?? job.customer?.name ?? null,
          customerPhone: job.customer?.phone ?? null,
          branchName: job.branch.name,
          scheduledDate: job.scheduledDate?.toISOString() ?? null,
          notes: job.notes,
          createdAt: job.createdAt.toISOString(),
          vehiclePlate: job.assignment?.vehicle.plateNumber ?? null,
          vehicleName: job.assignment?.vehicle.name ?? null,
          driverName: job.assignment
            ? `${job.assignment.driver.firstName} ${job.assignment.driver.lastName}`
            : null,
          driverPhone: job.assignment?.driver.phone ?? null,
          stops: job.stops.map((stop) => ({
            sequence: stop.sequence,
            customerName: stop.customerName,
            address: stop.address,
            contactName: stop.contactName,
            contactPhone: stop.contactPhone,
            weightKg: stop.weightKg,
          })),
        }}
      />
    )
  } catch {
    notFound()
  }
}
