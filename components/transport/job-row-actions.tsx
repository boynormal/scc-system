"use client"

import Link from "next/link"
import { Pencil, Printer } from "lucide-react"
import { CompleteJobButton } from "@/components/transport/complete-job-button"

type Props = {
  jobId: string
  jobStatus: string
}

export function JobRowActions({ jobId, jobStatus }: Props) {
  const isCancelled = jobStatus === "cancelled"

  return (
    <div className="flex items-center justify-end gap-1.5">
      {!isCancelled && (
        <Link
          href={`/transport/jobs/${jobId}/edit`}
          title="แก้ไข"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
          <Pencil className="h-3.5 w-3.5" />
          แก้ไข
        </Link>
      )}
      <Link
        href={`/transport/jobs/${jobId}/print`}
        target="_blank"
        title="พิมพ์"
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      >
        <Printer className="h-3.5 w-3.5" />
        พิมพ์
      </Link>
      <CompleteJobButton jobId={jobId} jobStatus={jobStatus} compact />
    </div>
  )
}
