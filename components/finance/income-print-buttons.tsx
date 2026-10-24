"use client"

import { useTranslations } from "next-intl"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

export type IncomePrintSize = "a4" | "80mm"

export function incomePrintHref(id: string, size: IncomePrintSize, auto = true): string {
  return `/finance/incomes/${id}/print?size=${size}${auto ? "&auto=1" : ""}`
}

export function IncomePrintButtons({ id, size }: { id: string; size?: "sm" }) {
  const t = useTranslations("financeIncome")
  const open = (paper: IncomePrintSize) => window.open(incomePrintHref(id, paper), "_blank", "noopener")
  const icon = <Printer className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
  return (
    <div className="inline-flex flex-wrap gap-2" role="group" aria-label={t("print")}>
      <Button type="button" variant="outline" size={size} icon={icon} onClick={() => open("a4")}>
        {t("printA4")}
      </Button>
      <Button type="button" variant="outline" size={size} icon={icon} onClick={() => open("80mm")}>
        {t("print80")}
      </Button>
    </div>
  )
}
