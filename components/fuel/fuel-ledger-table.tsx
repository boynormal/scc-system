import { getTranslations } from "next-intl/server"
import type { FuelTxnDto } from "@/modules/fuel"
import { AppDataTable, AppDataTableBody, AppDataTableHead } from "@/components/shell/app-data-table"
import { Badge } from "@/components/ui/badge"
import { ReverseFuelButton } from "./fuel-action-buttons"
import { fmtCost, fmtDateTime, fmtMoney, fmtQty, txnTypeVariant } from "./fuel-format"

/** Ledger rows; reverse is offered only for branches in `reversibleBranchIds` (null = all). */
export async function FuelLedgerTable({
  rows,
  showTank = true,
  showBalance = true,
  reversibleBranchIds,
  sticky = true,
}: {
  rows: FuelTxnDto[]
  showTank?: boolean
  showBalance?: boolean
  reversibleBranchIds: string[] | null
  sticky?: boolean
}) {
  const t = await getTranslations("fuel")
  const canReverse = (row: FuelTxnDto) =>
    row.type !== "REVERSAL" &&
    !row.reversedById &&
    (reversibleBranchIds === null || reversibleBranchIds.includes(row.branchId))

  return (
    <AppDataTable>
      <AppDataTableHead sticky={sticky}>
        <tr>
          <th>{t("occurredAt")}</th>
          {showTank && <th>{t("tank")}</th>}
          <th>{t("type")}</th>
          <th className="text-right">{t("usedLiters")}</th>
          <th className="hidden text-right xl:table-cell">{t("unitCost")}</th>
          <th className="text-right">{t("totalCost")}</th>
          {showBalance && <th className="hidden text-right lg:table-cell">{t("balance")}</th>}
          <th>{t("targetOrSupplier")}</th>
          <th className="hidden xl:table-cell">{t("by")}</th>
          <th className="text-right">{t("manage")}</th>
        </tr>
      </AppDataTableHead>
      <AppDataTableBody>
        {rows.map((row) => {
          const party =
            row.type === "DISPENSE"
              ? row.assetCode
                ? `${row.assetCode} ${row.assetName ?? ""}`
                : row.otherTargetName
              : row.type === "RECEIVE"
                ? [row.supplierName, row.documentNo].filter(Boolean).join(" · ")
                : row.remark
          const meter =
            row.meterReading !== null
              ? `${row.meterType === "HOUR_METER" ? t("meterHour") : t("meterOdometer")}: ${fmtQty(row.meterReading)}`
              : null
          return (
            <tr key={row.id}>
              <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums">{fmtDateTime(row.occurredAt)}</td>
              {showTank && (
                <td className="px-4 py-3">
                  <div className="font-medium">{row.tankCode}</div>
                  <div className="text-xs">{row.branchName}</div>
                </td>
              )}
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  <Badge variant={txnTypeVariant(row.type)}>{t(`type_${row.type}`)}</Badge>
                  {row.reversedById && <Badge variant="danger">{t("reversed")}</Badge>}
                </div>
              </td>
              <td
                className={`px-4 py-3 text-right font-semibold tabular-nums ${row.quantity < 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}
              >
                {row.quantity > 0 ? "+" : ""}
                {fmtQty(row.quantity)}
              </td>
              <td className="hidden px-4 py-3 text-right tabular-nums xl:table-cell">{fmtCost(row.unitCost)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(row.totalCost)}</td>
              {showBalance && (
                <td className="hidden px-4 py-3 text-right tabular-nums lg:table-cell">{fmtQty(row.balanceAfter)}</td>
              )}
              <td className="px-4 py-3">
                <div>{party || "—"}</div>
                {meter && <div className="text-xs">{meter}</div>}
                {row.type === "DISPENSE" && row.remark && <div className="text-xs">{row.remark}</div>}
              </td>
              <td className="hidden px-4 py-3 text-xs xl:table-cell">{row.createdByName ?? "—"}</td>
              <td className="px-4 py-3 text-right">
                {canReverse(row) && (
                  <ReverseFuelButton
                    id={row.id}
                    label={`${t(`type_${row.type}`)} ${fmtQty(Math.abs(row.quantity))} ${row.unit} · ${row.tankCode} · ${fmtDateTime(row.occurredAt)}`}
                  />
                )}
              </td>
            </tr>
          )
        })}
      </AppDataTableBody>
    </AppDataTable>
  )
}
