import { headers } from "next/headers"
import QRCode from "qrcode"
import { getTranslations } from "next-intl/server"
import { ClipboardList } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { ListPagination } from "@/components/ui/list-pagination"
import { AppDataTable, AppDataTableBody, AppDataTableHead, AppDataTablePanel } from "@/components/shell/app-data-table"
import { PmRowActions } from "@/components/assets/pm-row-actions"
import type { PmQrSticker } from "@/components/assets/pm-board-qr"

type PmBoardRow = {
  assetId: string
  code: string
  name: string
  branchName: string
  typeName: string
  publicPath: string
  dueStatus: "due" | "overdue" | "ok" | "inactive"
  intervalDays: number
  itemCount: number
  nextDueDate: string | null
}

async function requestOrigin() {
  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host")
  const proto = headerList.get("x-forwarded-proto") ?? "https"
  return (process.env.NEXTAUTH_URL ?? (host ? `${proto}://${host}` : "")).replace(/\/$/, "")
}

const statusClass: Record<PmBoardRow["dueStatus"], string> = {
  due: "bg-amber-100 text-amber-900",
  overdue: "bg-red-100 text-red-800",
  ok: "bg-emerald-100 text-emerald-900",
  inactive: "bg-muted text-muted-foreground",
}

export async function PmCheckBoard({
  rows,
  page,
  total,
  pageSize,
  canUpdate,
  query,
}: {
  rows: PmBoardRow[]
  page: number
  total: number
  pageSize: number
  canUpdate: boolean
  query?: Record<string, string | undefined>
}) {
  const t = await getTranslations("pmCheck")
  const assetsT = await getTranslations("assets")
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const origin = await requestOrigin()
  const stickers: PmQrSticker[] = await Promise.all(
    rows.map(async (row) => ({
      assetId: row.assetId,
      name: row.name,
      branchName: row.branchName,
      typeLabel: row.typeName,
      dataUrl: origin ? await QRCode.toDataURL(`${origin}${row.publicPath}`, { margin: 1, width: 220 }) : "",
    }))
  )
  const stickerByAsset = new Map(stickers.map((sticker) => [sticker.assetId, sticker]))

  if (total === 0) {
    return (
      <EmptyState icon={ClipboardList} title={t("empty")} description={t("emptyHint")} />
    )
  }

  return (
    <AppDataTablePanel>
        <AppDataTable>
          <AppDataTableHead>
            <tr>
              <th>{t("colName")}</th>
              <th>{assetsT("branch")}</th>
              <th>{assetsT("type")}</th>
              <th>{t("colStatus")}</th>
              <th>{t("nextDue")}</th>
              <th>{t("colInterval")}</th>
              <th>{t("colItems")}</th>
              <th className="text-right">{assetsT("manage")}</th>
            </tr>
          </AppDataTableHead>
          <AppDataTableBody>
            {rows.map((row) => {
              const sticker = stickerByAsset.get(row.assetId)
              return (
                <tr key={row.assetId}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.code}</p>
                  </td>
                  <td className="px-4 py-3">{row.branchName}</td>
                  <td className="px-4 py-3">{row.typeName}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass[row.dueStatus]}`}>
                      {t(`status_${row.dueStatus}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.nextDueDate ?? "—"}</td>
                  <td className="px-4 py-3">{row.intervalDays}</td>
                  <td className="px-4 py-3">{row.itemCount}</td>
                  <td className="px-4 py-3 text-right">
                    {sticker ? <PmRowActions sticker={sticker} canUpdate={canUpdate} /> : null}
                  </td>
                </tr>
              )
            })}
          </AppDataTableBody>
        </AppDataTable>
      <ListPagination
        pathname="/assets"
        page={page}
        totalPages={totalPages}
        total={total}
        query={query}
      />
    </AppDataTablePanel>
  )
}
