"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Printer } from "lucide-react"
import { cn, formatDate, formatDateTime } from "@/lib/utils"
import type { IncomeDto } from "./income-types"
import { incomePrintHref, type IncomePrintSize } from "./income-print-buttons"

const PAGE_CSS: Record<IncomePrintSize, string> = {
  a4: `
@media print {
  @page { size: A4; margin: 12mm; }
  html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
  .income-print-chrome { display: none !important; }
  .income-print-sheet { width: auto !important; min-height: 0 !important; padding: 0 !important; box-shadow: none !important; border: none !important; }
}`,
  "80mm": `
@media print {
  @page { size: 80mm auto; margin: 2mm; }
  html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
  .income-print-chrome { display: none !important; }
  .income-print-sheet { width: 76mm !important; max-width: 76mm !important; margin: 0 auto !important; padding: 0 !important; box-shadow: none !important; border: none !important; }
}`,
}

const moneyFormat = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function money(value: number) {
  return moneyFormat.format(value)
}

function qtyText(l: IncomeDto["lines"][number]) {
  return l.pricingMode === "QTY_PRICE" ? `${l.quantity.toLocaleString("th-TH")} ${l.unitCode ?? ""}`.trim() : "1"
}

function TotalsRows({ income, compact }: { income: IncomeDto; compact?: boolean }) {
  const t = useTranslations("financeIncome")
  const row = compact ? "flex justify-between text-[12px]" : "flex justify-between py-0.5"
  return (
    <>
      <div className={row}>
        <span>{t("totalAmount")}</span>
        <span className="tabular-nums">{money(income.amount)}</span>
      </div>
      <div className={row}>
        <span>{t("discount")}</span>
        <span className="tabular-nums">{money(income.discountAmount)}</span>
      </div>
      {income.taxMode === "VAT_INCLUSIVE" && (
        <div className={row}>
          <span>{t("beforeVat")}</span>
          <span className="tabular-nums">{money(income.netAmount - income.taxAmount)}</span>
        </div>
      )}
      {(income.taxMode !== "NONE" || income.taxAmount > 0) && (
        <div className={row}>
          <span>{t("vatLabel")}</span>
          <span className="tabular-nums">{money(income.taxAmount)}</span>
        </div>
      )}
      <div
        className={cn(
          "flex justify-between font-bold",
          compact ? "mt-1 border-t border-dashed border-slate-400 pt-1 text-[14px]" : "mt-1 border-t border-slate-400 pt-1.5 text-base"
        )}
      >
        <span>{t("netAmount")}</span>
        <span className="tabular-nums">{money(income.netAmount)}</span>
      </div>
    </>
  )
}

function A4Sheet({ income, companyName, logoUrl }: { income: IncomeDto; companyName: string; logoUrl: string | null }) {
  const t = useTranslations("financeIncome")
  const info: [string, string][] = [
    [t("incomeNo"), income.incomeNo],
    [t("incomeDate"), formatDate(income.incomeDate)],
    [t("branch"), income.branchName],
    [t("paymentMethod"), income.paymentMethod ? t(`paymentMethods.${income.paymentMethod}`) : "—"],
    [t("employee"), income.employeeName ?? "—"],
    [t("taxMode"), t(`taxModes.${income.taxMode}`)],
  ]
  return (
    <article className="income-print-sheet mx-auto min-h-[297mm] w-[210mm] bg-white p-[12mm] text-[13px] text-slate-900 shadow-sm ring-1 ring-slate-200 print:ring-0">
      <header className="flex items-start justify-between gap-6 border-b-2 border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          {logoUrl ? <img src={logoUrl} alt="" className="h-14 w-14 object-contain" /> : null}
          <p className="text-lg font-bold">{companyName}</p>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-bold">{t("printTitle")}</h1>
          <p className="mt-0.5 text-sm text-slate-600">{t(`statuses.${income.status}`)}</p>
        </div>
      </header>

      <section className="mt-4 grid grid-cols-[1fr_auto] gap-6">
        <div>
          <p className="text-xs font-semibold text-slate-600">{t("payer")}</p>
          <p className="text-base font-semibold">{income.payerName}</p>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
          {info.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-slate-600">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="border-y border-slate-800 text-left">
            <th className="w-10 py-1.5 pr-2 text-center">#</th>
            <th className="py-1.5 pr-2">{t("type")}</th>
            <th className="py-1.5 pr-2 text-right">{t("quantity")}</th>
            <th className="py-1.5 pr-2 text-right">{t("unitPrice")}</th>
            <th className="py-1.5 pr-2 text-right">{t("discount")}</th>
            <th className="py-1.5 text-right">{t("amount")}</th>
          </tr>
        </thead>
        <tbody>
          {income.lines.map((l) => (
            <tr key={l.id} className="border-b border-slate-200 align-top">
              <td className="py-1.5 pr-2 text-center tabular-nums">{l.lineNo}</td>
              <td className="py-1.5 pr-2">
                <div className="font-medium">{l.incomeTypeName}</div>
                {l.description ? <div className="text-xs text-slate-600">{l.description}</div> : null}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{qtyText(l)}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{money(l.unitPrice)}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{l.discountAmount ? money(l.discountAmount) : "—"}</td>
              <td className="py-1.5 text-right tabular-nums">{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-3 grid grid-cols-[1fr_18rem] gap-6">
        <div>
          {income.notes ? (
            <>
              <p className="text-xs font-semibold text-slate-600">{t("notes")}</p>
              <p className="whitespace-pre-wrap break-words">{income.notes}</p>
            </>
          ) : null}
        </div>
        <div>
          <TotalsRows income={income} />
        </div>
      </section>

      <section className="mt-16 grid grid-cols-2 gap-12 text-center">
        {[t("payerSign"), t("receiverSign")].map((label) => (
          <div key={label}>
            <div className="mx-auto w-56 border-b border-dotted border-slate-500 pb-8" />
            <p className="mt-1 font-medium">{label}</p>
            <p className="mt-1 text-xs text-slate-600">{t("signDate")}</p>
          </div>
        ))}
      </section>

      <p className="mt-8 text-right text-[11px] text-slate-500">
        {t("printedAt", { at: formatDateTime(new Date().toISOString()) })}
      </p>
    </article>
  )
}

function TicketSheet({ income, companyName }: { income: IncomeDto; companyName: string }) {
  const t = useTranslations("financeIncome")
  return (
    <article className="income-print-sheet mx-auto w-[80mm] max-w-[80mm] bg-white px-2 py-3 text-[12px] leading-snug text-slate-900 shadow-sm ring-1 ring-slate-200 print:ring-0">
      <header className="border-b border-dashed border-slate-400 pb-2 text-center">
        {companyName ? <p className="text-[14px] font-bold">{companyName}</p> : null}
        <p className="text-[13px] font-semibold">{t("printTitle")}</p>
        <p className="mt-0.5 text-[15px] font-bold">{income.incomeNo}</p>
        <p className="text-[11px] text-slate-600">
          {formatDate(income.incomeDate)} · {income.branchName}
        </p>
      </header>

      <section className="space-y-0.5 border-b border-dashed border-slate-300 py-2">
        <div className="flex justify-between gap-2">
          <span className="text-slate-600">{t("payer")}</span>
          <span className="text-right font-semibold">{income.payerName}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-600">{t("paymentMethod")}</span>
          <span className="text-right">{income.paymentMethod ? t(`paymentMethods.${income.paymentMethod}`) : "—"}</span>
        </div>
        {income.employeeName ? (
          <div className="flex justify-between gap-2">
            <span className="text-slate-600">{t("employee")}</span>
            <span className="text-right">{income.employeeName}</span>
          </div>
        ) : null}
      </section>

      <ul className="space-y-1.5 border-b border-dashed border-slate-300 py-2">
        {income.lines.map((l) => (
          <li key={l.id}>
            <div className="flex justify-between gap-2 font-medium">
              <span className="min-w-0 break-words">{l.incomeTypeName}</span>
              <span className="shrink-0 tabular-nums">{money(l.amount)}</span>
            </div>
            {l.pricingMode === "QTY_PRICE" ? (
              <p className="text-[11px] text-slate-600">
                {qtyText(l)} × {money(l.unitPrice)}
              </p>
            ) : null}
            {l.description ? <p className="text-[11px] text-slate-600">{l.description}</p> : null}
            {l.discountAmount ? (
              <p className="text-[11px] text-slate-600">
                {t("discount")} −{money(l.discountAmount)}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      <section className="space-y-0.5 py-2">
        <TotalsRows income={income} compact />
        {income.taxMode !== "NONE" ? (
          <p className="pt-1 text-center text-[11px] text-slate-600">{t(`taxModes.${income.taxMode}`)}</p>
        ) : null}
      </section>

      {income.notes ? (
        <p className="whitespace-pre-wrap break-words border-t border-dashed border-slate-300 pt-2 text-[11px]">{income.notes}</p>
      ) : null}

      <p className="mt-2 text-center text-[10px] text-slate-500">
        {t("printedAt", { at: formatDateTime(new Date().toISOString()) })}
      </p>
    </article>
  )
}

export function IncomePrintView({
  income,
  companyName,
  logoUrl,
  size,
  autoPrint = false,
}: {
  income: IncomeDto
  companyName: string
  logoUrl: string | null
  size: IncomePrintSize
  autoPrint?: boolean
}) {
  const t = useTranslations("financeIncome")

  useEffect(() => {
    if (!autoPrint) return
    const timer = window.setTimeout(() => window.print(), 300)
    return () => window.clearTimeout(timer)
  }, [autoPrint, size])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS[size] }} />

      <div className="income-print-chrome flex flex-wrap items-center justify-center gap-2 px-3 py-4 print:hidden">
        <span className="text-sm font-medium text-slate-700">{t("printPaper")}</span>
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1" role="group" aria-label={t("printPaper")}>
          {(["a4", "80mm"] as const).map((s) => (
            <Link
              key={s}
              href={incomePrintHref(income.id, s, false)}
              replace
              aria-current={s === size ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                s === size ? "bg-slate-800 text-white" : "text-slate-700 hover:bg-slate-100"
              )}
            >
              {s === "a4" ? "A4" : "80mm"}
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
        >
          <Printer className="h-4 w-4" />
          {t("print")}
        </button>
      </div>

      <div className="px-3 pb-8 print:px-0 print:pb-0">
        {size === "a4" ? (
          <A4Sheet income={income} companyName={companyName} logoUrl={logoUrl} />
        ) : (
          <TicketSheet income={income} companyName={companyName} />
        )}
      </div>
    </>
  )
}
