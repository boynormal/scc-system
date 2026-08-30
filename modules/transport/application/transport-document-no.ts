export type TransportDocumentKind = "TJ" | "RP" | "TY"

export function transportDocumentPrefix(
  kind: TransportDocumentKind,
  year = new Date().getFullYear()
): string {
  return `${kind}-${year}-`
}

export function formatTransportDocumentNo(
  kind: TransportDocumentKind,
  seq: number,
  year = new Date().getFullYear()
): string {
  return `${transportDocumentPrefix(kind, year)}${String(seq).padStart(5, "0")}`
}

export function parseTransportDocumentSeq(
  documentNo: string | null | undefined,
  prefix: string
): number {
  if (!documentNo?.startsWith(prefix)) return 0
  const n = parseInt(documentNo.slice(prefix.length), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function nextTransportDocumentNoFromLatest(
  kind: TransportDocumentKind,
  latest: string | null | undefined,
  year = new Date().getFullYear()
): string {
  const prefix = transportDocumentPrefix(kind, year)
  return formatTransportDocumentNo(kind, parseTransportDocumentSeq(latest, prefix) + 1, year)
}

export async function nextTransportDocumentNo(
  kind: TransportDocumentKind,
  findLatest: (prefix: string) => Promise<string | null | undefined>
): Promise<string> {
  const year = new Date().getFullYear()
  const latest = await findLatest(transportDocumentPrefix(kind, year))
  return nextTransportDocumentNoFromLatest(kind, latest, year)
}
