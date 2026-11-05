"use client"

import { useRouter } from "next/navigation"
import { CreateJobForm } from "@/components/transport/CreateJobForm"

export function NewJobPageForm({ pickupRequestId }: { pickupRequestId?: string }) {
  const router = useRouter()
  const backHref = pickupRequestId ? "/transport/pickup-requests" : "/transport/jobs"

  return (
    <CreateJobForm
      pickupRequestId={pickupRequestId}
      onCancel={() => router.push(backHref)}
      onSuccess={() => router.push(backHref)}
    />
  )
}
