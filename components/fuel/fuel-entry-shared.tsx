"use client"

import { useTranslations } from "next-intl"
import type { FuelTankDto } from "@/modules/fuel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { fmtQty, nowLocalInput } from "./fuel-format"
import { TankLevel } from "./tank-level"

type Option = { id: string; name: string }

/** Branch + tank pickers shared by the receive and dispense forms. */
export function TankPicker({
  branches,
  tanks,
  branchId,
  tankId,
  onBranch,
  onTank,
}: {
  branches: Option[]
  tanks: FuelTankDto[]
  branchId: string
  tankId: string
  onBranch: (id: string) => void
  onTank: (id: string) => void
}) {
  const t = useTranslations("fuel")
  const branchTanks = tanks.filter((x) => x.branchId === branchId)
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Select
        label={t("branch")}
        required
        value={branchId}
        onChange={(e) => onBranch(e.target.value)}
        placeholder={branches.length > 1 ? t("selectBranch") : undefined}
        options={branches.map((b) => ({ value: b.id, label: b.name }))}
      />
      <Select
        label={t("tank")}
        required
        value={tankId}
        onChange={(e) => onTank(e.target.value)}
        placeholder={t("selectTank")}
        options={branchTanks.map((x) => ({ value: x.id, label: `${x.code} · ${x.name} (${x.fuelTypeName})` }))}
      />
    </div>
  )
}

export function TankStatusLine({ tank, afterQty }: { tank: FuelTankDto; afterQty: number | null }) {
  const t = useTranslations("fuel")
  const over = afterQty !== null && afterQty > tank.capacity
  const under = afterQty !== null && afterQty < 0
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
      <div className="mb-2 flex items-center gap-2">
        <TankLevel percent={tank.fillPercent} low={tank.isLow} />
        <span className="w-12 text-right text-xs tabular-nums">{tank.fillPercent}%</span>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <span>
          {t("currentInTank")}: <b className="tabular-nums">{fmtQty(tank.currentQty)}</b> / {fmtQty(tank.capacity)} {tank.unit}
        </span>
        <span>
          {t("spaceLeft")}: <b className="tabular-nums">{fmtQty(Math.max(0, tank.capacity - tank.currentQty))}</b> {tank.unit}
        </span>
        {afterQty !== null && (
          <span className={over || under ? "font-semibold text-red-600" : undefined}>
            {t("remainingAfter")}: <b className="tabular-nums">{fmtQty(afterQty)}</b> {tank.unit}
            {over && ` · ${t("overCapacity")}`}
            {under && ` · ${t("notEnough")}`}
          </span>
        )}
      </div>
    </div>
  )
}

export function TextArea({
  label,
  value,
  onChange,
  maxLength = 1000,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  maxLength?: number
}) {
  const id = `fuel-${label}`
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <textarea
        id={id}
        rows={2}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

/** Required date and time of the refill or dispense, with a one-tap "now". */
export function OccurredAtField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations("fuel")
  return (
    <div className="flex flex-wrap items-start gap-2">
      <div className="w-full min-w-[17rem] max-w-xs">
        <Input
          label={t("occurredAt")}
          required
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          hint={t("occurredAtHint")}
          className="min-w-[17rem]"
        />
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-7 shrink-0" onClick={() => onChange(nowLocalInput())}>
        {t("useNow")}
      </Button>
    </div>
  )
}

export function initialBranchTank(branches: Option[], tanks: FuelTankDto[], tankId?: string | null) {
  const preset = tankId ? tanks.find((x) => x.id === tankId) : undefined
  if (preset) return { branchId: preset.branchId, tankId: preset.id }
  const branchId = branches.length === 1 ? branches[0].id : ""
  const own = tanks.filter((x) => x.branchId === branchId)
  return { branchId, tankId: own.length === 1 ? own[0].id : "" }
}
