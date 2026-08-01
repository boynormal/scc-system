"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { CreateJobModal } from "@/components/transport/CreateJobModal"

type Props = {
  label: string
}

export function CreateJobButton({ label }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cyan-700"
      >
        <Plus className="h-4 w-4" />
        {label}
      </button>

      <CreateJobModal
        open={open}
        onCancel={() => setOpen(false)}
        onSuccess={() => {
          setOpen(false)
          router.push("/transport/jobs")
          router.refresh()
        }}
      />
    </>
  )
}
