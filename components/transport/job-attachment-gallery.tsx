import type { AttachmentStage } from "@prisma/client"
import Image from "next/image"

const STAGE_LABELS: Record<AttachmentStage, string> = {
  before_trip: "ก่อนออกเดินทาง",
  at_pickup: "จุดรับสินค้า",
  transit: "ระหว่างทาง",
  at_delivery: "จุดส่งสินค้า",
  after_trip: "หลังสิ้นสุด",
}

type Attachment = {
  id: string
  fileUrl: string
  fileType: string
  originalFileName: string
  stage: AttachmentStage
  caption?: string | null
  takenAt: Date | string
}

export function JobAttachmentGallery({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) {
    return <p className="text-sm text-slate-400">ไม่มีไฟล์แนบ</p>
  }

  const grouped = attachments.reduce<Record<AttachmentStage, Attachment[]>>(
    (acc, a) => {
      if (!acc[a.stage]) acc[a.stage] = []
      acc[a.stage].push(a)
      return acc
    },
    {} as Record<AttachmentStage, Attachment[]>
  )

  return (
    <div className="space-y-6">
      {(Object.keys(STAGE_LABELS) as AttachmentStage[]).map((stage) => {
        const items = grouped[stage]
        if (!items?.length) return null
        return (
          <div key={stage}>
            <h4 className="mb-2 text-sm font-medium text-slate-700">{STAGE_LABELS[stage]}</h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {items.map((item) => (
                <a
                  key={item.id}
                  href={item.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                >
                  {item.fileType.startsWith("image/") ? (
                    <Image
                      src={item.fileUrl}
                      alt={item.caption ?? item.originalFileName}
                      width={200}
                      height={150}
                      className="h-32 w-full object-cover transition group-hover:opacity-90"
                    />
                  ) : (
                    <div className="flex h-32 items-center justify-center">
                      <span className="text-xs text-slate-500">{item.originalFileName}</span>
                    </div>
                  )}
                  {item.caption && (
                    <div className="p-1.5">
                      <p className="truncate text-xs text-slate-600">{item.caption}</p>
                    </div>
                  )}
                </a>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
