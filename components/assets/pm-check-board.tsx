import { headers } from "next/headers"
import QRCode from "qrcode"
import { getTranslations } from "next-intl/server"
import { ClipboardList } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { ListPagination } from "@/components/ui/list-pagination"
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

  const headClass = "border-b border-[#cbd5e1] bg-[#e2e8f0] px-4 py-3 text-left text-xs font-semibold text-[#0f172a]"
  const cellClass = "border-b border-[#e2e8f0] bg-[#ffffff] px-4 py-3 text-sm text-[#0f172a]"

  return (
    <div className="overflow-x-auto rounded-xl border border-[#cbd5e1] bg-[#ffffff] shadow-sm">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className={headClass}>{t("colName")}</th>
              <th className={headClass}>{assetsT("branch")}</th>
              <th className={headClass}>{assetsT("type")}</th>
              <th className={headClass}>{t("colStatus")}</th>
              <th className={headClass}>{t("nextDue")}</th>
              <th className={headClass}>{t("colInterval")}</th>
              <th className={headClass}>{t("colItems")}</th>
              <th className={`${headClass} text-right`}>{assetsT("manage")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const sticker = stickerByAsset.get(row.assetId)
              return (
                <tr key={row.assetId}>
                  <td className={cellClass}>
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-xs text-[#475569]">{row.code}</p>
                  </td>
                  <td className={cellClass}>{row.branchName}</td>
                  <td className={cellClass}>{row.typeName}</td>
                  <td className={cellClass}>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass[row.dueStatus]}`}>
                      {t(`status_${row.dueStatus}`)}
                    </span>
                  </td>
                  <td className={cellClass}>{row.nextDueDate ?? "—"}</td>
                  <td className={cellClass}>{row.intervalDays}</td>
                  <td className={cellClass}>{row.itemCount}</td>
                  <td className={`${cellClass} text-right`}>
                    {sticker ? <PmRowActions sticker={sticker} canUpdate={canUpdate} /> : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <ListPagination
          pathname="/assets"
          page={page}
          totalPages={totalPages}
          total={total}
          query={query}
        />
    </div>
  )
}
