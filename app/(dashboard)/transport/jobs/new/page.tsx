"use client"

import { useRouter } from "next/navigation"
import { CreateJobForm } from "@/components/transport/CreateJobForm"

export default function NewTransportJobPage() {
  const router = useRouter()

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">สร้างใบงานขนส่งใหม่</h1>
        <p className="text-sm text-muted-foreground">กรอกข้อมูลงานขนส่งและจุดแวะ</p>
      </div>

      <CreateJobForm
        onCancel={() => router.push("/transport/jobs")}
        onSuccess={() => router.push("/transport/jobs")}
      />
    </div>
  )
}
