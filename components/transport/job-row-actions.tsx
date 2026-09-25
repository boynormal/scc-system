"use client"

import { useState } from "react"
import Link from "next/link"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { ChevronDown, ClipboardCheck, Pencil, Printer } from "lucide-react"
import { CompleteJobButton } from "@/components/transport/complete-job-button"
import { CancelJobButton } from "@/components/transport/cancel-job-button"
import { ReopenJobButton } from "@/components/transport/reopen-job-button"
import { cn } from "@/lib/utils"

type Props = {
  jobId: string
  jobStatus: string
}

const itemClass =
  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-foreground outline-none data-[highlighted]:bg-muted/60"

export function JobRowActions({ jobId, jobStatus }: Props) {
  const isTerminal = jobStatus === "completed" || jobStatus === "cancelled"
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialogLock, setDialogLock] = useState(false)

  const onDialogChange = (open: boolean) => {
    setDialogLock(open)
    if (!open) setMenuOpen(false)
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu.Root
        modal={false}
        open={menuOpen}
        onOpenChange={(next) => {
          if (!next && dialogLock) return
          setMenuOpen(next)
        }}
      >
        <DropdownMenu.Trigger
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          จัดการ
          <ChevronDown className="h-3.5 w-3.5" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className={cn(
              "z-50 min-w-[11rem] rounded-lg border border-border bg-card p-1 shadow-lg",
              dialogLock && "hidden"
            )}
          >
            <DropdownMenu.Item asChild>
              <Link href={`/transport/jobs/${jobId}/log`} className={itemClass}>
                <ClipboardCheck className="h-3.5 w-3.5" />
                บันทึกเวลา
              </Link>
            </DropdownMenu.Item>
            {!isTerminal && (
              <DropdownMenu.Item asChild>
                <Link href={`/transport/jobs/${jobId}/edit`} className={itemClass}>
                  <Pencil className="h-3.5 w-3.5" />
                  แก้ไข
                </Link>
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Item asChild>
              <Link
                href={`/transport/jobs/${jobId}/print`}
                target="_blank"
                rel="noreferrer"
                className={itemClass}
              >
                <Printer className="h-3.5 w-3.5" />
                พิมพ์
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            {isTerminal ? (
              <ReopenJobButton jobId={jobId} jobStatus={jobStatus} variant="menu" onDialogChange={onDialogChange} />
            ) : (
              <>
                <CompleteJobButton jobId={jobId} jobStatus={jobStatus} variant="menu" onDialogChange={onDialogChange} />
                <CancelJobButton jobId={jobId} jobStatus={jobStatus} variant="menu" onDialogChange={onDialogChange} />
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  )
}
