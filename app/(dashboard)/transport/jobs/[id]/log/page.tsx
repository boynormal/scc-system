import { auth } from "@/lib/auth"
import { cookies } from "next/headers"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { getJobPunchView } from "@/modules/transport"
import { JobPunchPanel } from "@/components/transport/job-punch-panel"
import { RememberDriverJob } from "@/components/transport/remember-driver-job"
import { ForbiddenError, NotFoundError } from "@/lib/errors"
import { DRIVER_JOB_COOKIE, driverJobFromCookie } from "@/lib/driver-session"

export default async function TransportJobLogPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const { id } = await params
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(`/transport/jobs/${id}/log`)}`)

  try {
    const view = await getJobPunchView(prisma, {
      id,
      companyId: session.user.companyId as string,
      userId: session.user.id as string,
      roles: session.user.roles as UserRole[],
    })
    const canRecord =
      Boolean(session.user.driverLogin) && view.status !== "completed" && view.status !== "cancelled"

    return (
      <div className="mx-auto w-full min-w-0 max-w-md">
        {session.user.driverLogin ? <RememberDriverJob jobId={id} /> : null}
        <JobPunchPanel
          jobId={id}
          jobNumber={view.jobNumber}
          stops={view.stops}
          punches={view.punches.map((punch) => ({
            ...punch,
            recordedAt: punch.recordedAt.toISOString(),
          }))}
          legs={view.legs}
          next={view.next}
          canSkipStopId={view.canSkipStopId}
          canRecord={canRecord}
        />
      </div>
    )
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    if (error instanceof ForbiddenError) {
      if (session.user.driverLogin) await redirectDriverAway(id)
      redirect("/")
    }
    throw error
  }
}

async function redirectDriverAway(currentJobId: string): Promise<never> {
  const cookieStore = await cookies()
  const remembered = driverJobFromCookie(cookieStore.get(DRIVER_JOB_COOKIE)?.value)
  if (remembered && remembered !== currentJobId) redirect(`/transport/jobs/${remembered}/log`)
  redirect("/api/transport/driver-job?clear=1")
}
