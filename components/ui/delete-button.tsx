"use client"

import { useState } from "react"
import { Trash2, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

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

  const handleDelete = async () => {
    const input = window.prompt(`${confirmMessage}\nพิมพ์ "Yes" (ตัวพิมพ์ใหญ่ Y) เพื่อยืนยันการลบ:`)
    if (input !== "Yes") return

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
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className={`p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
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
