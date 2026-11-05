import { NewJobPageForm } from "@/components/transport/new-job-page-form"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function NewTransportJobPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { pickupRequest } = await searchParams
  const pickupRequestId = pickupRequest && UUID.test(pickupRequest) ? pickupRequest : undefined

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">สร้างใบงานขนส่งใหม่</h1>
        <p className="text-sm text-muted-foreground">กรอกข้อมูลงานขนส่งและจุดแวะ</p>
      </div>

      <NewJobPageForm pickupRequestId={pickupRequestId} />
    </div>
  )
}
