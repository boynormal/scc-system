"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

export function DocFavoriteButton({
  id,
  favorite,
  addLabel,
  removeLabel,
}: {
  id: string
  favorite: boolean
  addLabel: string
  removeLabel: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  return (
    <button
      type="button"
      aria-label={favorite ? removeLabel : addLabel}
      aria-pressed={favorite}
      disabled={pending}
      className="rounded-md p-1 text-foreground hover:bg-muted disabled:opacity-50"
      onClick={async (event) => {
        event.preventDefault()
        event.stopPropagation()
        setPending(true)
        try {
          await fetch(`/api/document-center/documents/${id}/favorite`, { method: favorite ? "DELETE" : "POST" })
          router.refresh()
        } finally {
          setPending(false)
        }
      }}
    >
      <Star className={cn("h-4 w-4", favorite && "fill-current")} />
    </button>
  )
}
