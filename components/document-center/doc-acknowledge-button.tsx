"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function DocAcknowledgeButton({
  documentId,
  label,
  pendingLabel,
  failedLabel,
}: {
  documentId: string
  label: string
  pendingLabel: string
  failedLabel: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-2">
      <Button
        type="button"
        loading={pending}
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setError(null)
          const res = await fetch(`/api/document-center/documents/${documentId}/acknowledge`, { method: "POST" })
          setPending(false)
          if (!res.ok) {
            setError(failedLabel)
            return
          }
          router.refresh()
        }}
      >
        {pending ? pendingLabel : label}
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
