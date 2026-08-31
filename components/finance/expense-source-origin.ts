import { COST_OBJECT_TYPE_LABELS, sourceModuleLabel, sourceTypeLabel } from "./finance-theme"

export type SourceOriginInput = {
  sourceKind?: string | null
  sourceModule?: string | null
  sourceType?: string | null
  description?: string | null
  costObjectType?: string | null
  costObjectLabel?: string | null
  sourceDocumentNo?: string | null
}

export type SourceOriginDisplay = {
  kind: string
  reference: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuidLike(value: string): boolean {
  return UUID_RE.test(value.trim())
}

function humanText(value: string | null | undefined): string | null {
  const text = value?.trim()
  if (!text || isUuidLike(text)) return null
  return text
}

/** Document number from the operational module, then stored bill text. Never a live module amount. */
export function readableSourceReference(input: SourceOriginInput): string | null {
  const documentNo = humanText(input.sourceDocumentNo)
  if (documentNo) return documentNo
  const description = humanText(input.description)
  if (description) return description
  const label = humanText(input.costObjectLabel)
  if (!label) return null
  const kind = input.costObjectType ? COST_OBJECT_TYPE_LABELS[input.costObjectType] : null
  return kind ? `${kind} ${label}` : label
}

export function formatExpenseSourceOrigin(input: SourceOriginInput): SourceOriginDisplay {
  const linked = Boolean(
    input.sourceKind && input.sourceKind !== "MANUAL" && (input.sourceModule || input.sourceType)
  )
  if (!linked) return { kind: "บันทึกเอง", reference: null }
  return {
    kind: sourceTypeLabel(input.sourceType) ?? sourceModuleLabel(input.sourceModule),
    reference: readableSourceReference(input),
  }
}

export function summarizeExpenseSourceOrigin(lines: SourceOriginInput[]): SourceOriginDisplay {
  const origins = lines.map(formatExpenseSourceOrigin)
  const imported = origins.filter((o) => o.kind !== "บันทึกเอง")
  if (imported.length === 0) return { kind: "บันทึกเอง", reference: null }

  const kinds = [...new Set(imported.map((o) => o.kind))]
  const refs = [...new Set(imported.map((o) => o.reference).filter((r): r is string => Boolean(r)))]
  const hasManual = origins.some((o) => o.kind === "บันทึกเอง")

  let kind = kinds.length === 1 ? kinds[0] : "หลายประเภท"
  if (hasManual) kind = kinds.length === 1 ? `${kinds[0]} + บันทึกเอง` : "ผสม"

  if (refs.length === 0) return { kind, reference: null }
  if (refs.length === 1) return { kind, reference: refs[0] }
  return { kind, reference: `${refs[0]} และอีก ${refs.length - 1} รายการ` }
}
