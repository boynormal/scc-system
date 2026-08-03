"use client"

import { useState } from "react"
import { Trash2, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTypeConfirm } from "@/components/ui/type-confirm"

interface DeleteButtonProps {
  url: string
  confirmMessage?: string
  onSuccess?: () => void
  redirectUrl?: string
  className?: string
  iconOnly?: boolean
}

export function DeleteButton({
  url,
  confirmMessage = "คุณต้องการลบข้อมูลนี้ใช่หรือไม่?",
  onSuccess,
  redirectUrl,
  className = "",
  iconOnly = true,
}: DeleteButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const confirmType = useTypeConfirm()

  const handleDelete = async () => {
    const ok = await confirmType({
      title: "ยืนยันการลบ",
      message: confirmMessage,
    })
    if (!ok) return

    setIsDeleting(true)
    try {
      const res = await fetch(url, { method: "DELETE" })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "เกิดข้อผิดพลาดในการลบ")
      }

      if (onSuccess) {
        onSuccess()
      } else if (redirectUrl) {
        router.push(redirectUrl)
        router.refresh()
      } else {
        router.refresh()
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการลบ")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isDeleting}
      className={`p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      title="ลบ"
    >
      {isDeleting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Trash2 className="w-4 h-4" />
      )}
      {!iconOnly && <span className="ml-2">ลบ</span>}
    </button>
  )
}
