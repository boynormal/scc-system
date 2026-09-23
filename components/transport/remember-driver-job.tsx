"use client"

import { useEffect } from "react"

export function RememberDriverJob({ jobId }: { jobId: string }) {
  useEffect(() => {
    void fetch("/api/transport/driver-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    })
  }, [jobId])
  return null
}
