import Link from "next/link"
import { canPreviewKind, documentFilePath, type DocListItem } from "@/modules/document_center"
import { DataPanel } from "@/components/shell/data-panel"
import { DocFavoriteButton } from "./doc-favorite-button"
import { DocFileIcon } from "./doc-file-icon"
import { docHref } from "./doc-href"

const previewFrame = "h-[min(70vh,40rem)] w-full"

export function DocPreviewPanel({
  item,
  pathname,
  query,
  panel,
  labels,
}: {
  item: DocListItem | null
  pathname: string
  query: Record<string, string | undefined>
  panel: "preview" | "details"
  labels: {
    preview: string
    details: string
    unsupported: string
    unsupportedDesc: string
    download: string
    openDetail: string
    empty: string
    code: string
    category: string
    type: string
    version: string
    updated: string
    favoriteAdd: string
    favoriteRemove: string
  }
}) {
  if (!item) {
    return (
      <DataPanel padding="md" className={`hidden xl:flex xl:items-center xl:justify-center ${previewFrame}`}>
        <p className="text-center text-base text-foreground">{labels.empty}</p>
      </DataPanel>
    )
  }
  const previewUrl = item.versionId ? documentFilePath(item.id, item.versionId, "inline") : null
  const downloadUrl = item.versionId ? documentFilePath(item.id, item.versionId, "attachment") : null
  const showPreview = previewUrl && canPreviewKind(item.fileKind)
  return (
    <DataPanel padding="sm" className="hidden xl:block">
      <div className="mb-3 flex gap-2 text-sm">
        <Link href={docHref(pathname, query, { panel: null, selected: item.id })} className={panel === "preview" ? "font-semibold text-foreground underline" : "text-foreground"}>
          {labels.preview}
        </Link>
        <Link href={docHref(pathname, query, { panel: "details", selected: item.id })} className={panel === "details" ? "font-semibold text-foreground underline" : "text-foreground"}>
          {labels.details}
        </Link>
      </div>
      {panel === "details" ? (
        <dl className="space-y-2 text-sm text-foreground">
          <div><dt className="font-medium">{labels.code}</dt><dd>{item.documentCode}</dd></div>
          <div><dt className="font-medium">{labels.category}</dt><dd>{item.categoryName}</dd></div>
          <div><dt className="font-medium">{labels.type}</dt><dd>{item.typeName}</dd></div>
          <div><dt className="font-medium">{labels.version}</dt><dd>{item.versionNumber ?? "-"}</dd></div>
          <div><dt className="font-medium">{labels.updated}</dt><dd>{new Date(item.updatedAt).toLocaleString()} · {item.updatedByName}</dd></div>
          <div className="flex items-center gap-2 pt-2">
            <DocFavoriteButton id={item.id} favorite={item.favorite} addLabel={labels.favoriteAdd} removeLabel={labels.favoriteRemove} />
            <Link href={`/document-center/${item.id}`} className="underline">{labels.openDetail}</Link>
          </div>
        </dl>
      ) : showPreview && item.fileKind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl!} alt={item.documentName} className={`${previewFrame} rounded-lg object-contain`} />
      ) : showPreview ? (
        <iframe title={item.documentName} src={previewUrl!} className={`${previewFrame} rounded-lg border border-border bg-white`} />
      ) : (
        <div className={`flex flex-col items-center justify-center gap-3 text-center text-foreground ${previewFrame}`}>
          <DocFileIcon kind={item.fileKind} />
          <p className="font-medium">{labels.unsupported}</p>
          <p className="text-sm">{labels.unsupportedDesc}</p>
          {downloadUrl ? <a className="underline" href={downloadUrl}>{labels.download}</a> : null}
        </div>
      )}
    </DataPanel>
  )
}
