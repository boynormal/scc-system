import { FileImage, FileSpreadsheet, FileText, Presentation } from "lucide-react"
import type { DocFileKind } from "@/modules/document_center"
import { cn } from "@/lib/utils"

const KIND: Record<DocFileKind, { icon: typeof FileText; className: string }> = {
  pdf: { icon: FileText, className: "text-red-600" },
  excel: { icon: FileSpreadsheet, className: "text-green-600" },
  word: { icon: FileText, className: "text-blue-600" },
  powerpoint: { icon: Presentation, className: "text-orange-600" },
  image: { icon: FileImage, className: "text-foreground" },
  other: { icon: FileText, className: "text-foreground" },
}

export function DocFileIcon({ kind, className }: { kind: DocFileKind; className?: string }) {
  const item = KIND[kind]
  const Icon = item.icon
  return <Icon className={cn("h-8 w-8", item.className, className)} aria-hidden />
}
