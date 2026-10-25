"use client"

import { Paperclip, X } from "lucide-react"

export type IncomeFileThumb = {
  key: string
  name: string
  href: string
  preview: boolean
  removable?: boolean
}

export function IncomeFileThumbs({
  items,
  onRemove,
  removingKey,
  removeLabel,
}: {
  items: IncomeFileThumb[]
  onRemove?: (key: string) => void
  removingKey?: string | null
  removeLabel: string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <div key={item.key} className="relative h-[4.5rem] w-[4.5rem] shrink-0">
          <a
            href={item.href}
            target="_blank"
            rel="noreferrer"
            title={item.name}
            className="flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
          >
            {item.preview ? (
              <img src={item.href} alt={item.name} className="h-full w-full object-cover" />
            ) : (
              <Paperclip className="h-5 w-5 text-slate-500" />
            )}
          </a>
          {item.removable && onRemove && (
            <button
              type="button"
              aria-label={removeLabel}
              disabled={removingKey === item.key}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#dc2626] text-white hover:bg-[#b91c1c] disabled:opacity-50"
              onClick={() => onRemove(item.key)}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
