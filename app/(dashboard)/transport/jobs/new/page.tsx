"use client"

import { useRouter } from "next/navigation"
import { CreateJobForm } from "@/components/transport/CreateJobForm"

export default function NewTransportJobPage() {
  const router = useRouter()

  return (
    <div className="mx-auto min-h-0 max-w-3xl flex-1 space-y-6 overflow-y-auto p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">สร้างใบงานขนส่งใหม่</h1>
        <p className="text-sm text-muted-foreground">กรอกข้อมูลงานขนส่งและจุดแวะ</p>
      </div>

      <CreateJobForm
        onCancel={() => router.push("/transport/jobs")}
        onSuccess={(jobId) => router.push(`/transport/jobs/${jobId}`)}
      />
    </div>
  )
}
