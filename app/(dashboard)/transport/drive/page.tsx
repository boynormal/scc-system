import { auth } from "@/lib/auth"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { DRIVER_JOB_COOKIE, driverJobFromCookie } from "@/lib/driver-session"

export default async function TransportDrivePage() {
  const session = await auth()
  if (!session) redirect("/login?callbackUrl=/transport/drive")

  const cookieStore = await cookies()
  const jobId = driverJobFromCookie(cookieStore.get(DRIVER_JOB_COOKIE)?.value)
  if (session.user.driverLogin && jobId) redirect(`/transport/jobs/${jobId}/log`)

  return (
    <div className="mx-auto max-w-lg space-y-3 p-4">
      <h1 className="text-xl font-semibold text-foreground">สแกน QR ใบงาน</h1>
      <p className="text-sm text-muted-foreground">
        เปิดกล้องสแกน QR บนใบงานที่พิมพ์ไว้ ระบบจะเปิดหน้าบันทึกเวลาและเลขไมล์ของใบนั้นให้
      </p>
    </div>
  )
}
