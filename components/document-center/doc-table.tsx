import Link from "next/link"
import type { DocListItem } from "@/modules/document_center"
import { AppDataTable, AppDataTableBody, AppDataTableHead } from "@/components/shell/app-data-table"
import { DocFavoriteButton } from "./doc-favorite-button"
import { DocFileIcon } from "./doc-file-icon"
import { docHref } from "./doc-href"

export function DocTable({
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
  labels: {
    name: string
    category: string
    type: string
    file: string
    version: string
    updated: string
    favoriteAdd: string
    favoriteRemove: string
  }
}) {
  return (
    <AppDataTable>
      <AppDataTableHead>
        <tr>
          <th>{labels.name}</th>
          <th className="hidden xl:table-cell">{labels.category}</th>
          <th className="hidden xl:table-cell">{labels.type}</th>
          <th>{labels.file}</th>
          <th className="hidden xl:table-cell">{labels.version}</th>
          <th className="hidden xl:table-cell">{labels.updated}</th>
          <th />
        </tr>
      </AppDataTableHead>
      <AppDataTableBody>
        {items.map((item) => (
          <tr key={item.id} data-tone={item.id === selectedId ? "selected" : undefined}>
            <td className="px-4 py-3">
              <Link href={docHref(pathname, query, { selected: item.id })} className="font-medium">
                {item.documentCode}
              </Link>
              <div>{item.documentName}</div>
            </td>
            <td className="hidden px-4 py-3 xl:table-cell">{item.categoryName}</td>
            <td className="hidden px-4 py-3 xl:table-cell">{item.typeName}</td>
            <td className="px-4 py-3">
              <span className="inline-flex items-center gap-2">
                <DocFileIcon kind={item.fileKind} className="h-4 w-4" />
                {item.fileName}
              </span>
            </td>
            <td className="hidden px-4 py-3 xl:table-cell">{item.versionNumber ?? ""}</td>
            <td className="hidden px-4 py-3 xl:table-cell">{new Date(item.updatedAt).toLocaleString()}</td>
            <td className="px-4 py-3">
              <DocFavoriteButton id={item.id} favorite={item.favorite} addLabel={labels.favoriteAdd} removeLabel={labels.favoriteRemove} />
            </td>
          </tr>
        ))}
      </AppDataTableBody>
    </AppDataTable>
  )
}
