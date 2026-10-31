import Link from "next/link"
import type { DocListItem } from "@/modules/document_center"
import { documentFilePath } from "@/modules/document_center"
import { DocFavoriteButton } from "./doc-favorite-button"
import { DocFileIcon } from "./doc-file-icon"
import { docHref } from "./doc-href"

export function DocGrid({
  items,
  pathname,
  query,
  selectedId,
  labels,
}: {
  items: DocListItem[]
  pathname: string
  query: Record<string, string | undefined>
  selectedId?: string
  labels: { favoriteAdd: string; favoriteRemove: string; openDetail: string; download: string; version: string }
}) {
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const selected = item.id === selectedId
        return (
          <div key={item.id} data-tone={selected ? "selected" : undefined} className={`rounded-xl border border-border p-3 text-foreground ${selected ? "ring-2 ring-blue-500" : ""}`}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <Link href={docHref(pathname, query, { selected: item.id, panel: null })} className="min-w-0" aria-current={selected ? "true" : undefined}>
                <DocFileIcon kind={item.fileKind} />
              </Link>
              <DocFavoriteButton id={item.id} favorite={item.favorite} addLabel={labels.favoriteAdd} removeLabel={labels.favoriteRemove} />
            </div>
            <Link href={docHref(pathname, query, { selected: item.id, panel: null })} className="block min-w-0">
              <div className="truncate text-sm font-medium">{item.documentName}</div>
              <div className="truncate text-xs">{item.documentCode} · {item.typeCode}</div>
            </Link>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs">
              <span>{item.versionNumber ? `${labels.version} ${item.versionNumber}` : ""}</span>
              <span>{new Date(item.updatedAt).toLocaleString()}</span>
            </div>
            <div className="mt-2 flex gap-3 text-xs">
              <Link href={`/document-center/${item.id}`} className="underline">{labels.openDetail}</Link>
              {item.versionId ? (
                <a href={documentFilePath(item.id, item.versionId, "attachment")} className="underline">{labels.download}</a>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
