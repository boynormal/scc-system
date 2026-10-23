export type PmAssetOption = {
  id: string
  code: string
  name: string
  branchName: string
  typeName: string
  machineId: string | null
  link: { kind: "machine" | "vehicle"; id: string; code: string; name: string } | null
}

export function pmAssetLabel(asset: PmAssetOption): string {
  return `${asset.code} - ${asset.name}`
}

export function pmAssetHint(options: PmAssetOption[] | null, selected: PmAssetOption | null): string | undefined {
  if (options && options.length === 0) {
    return "ยังไม่มีทรัพย์สินที่เปิดเข้าแผนซ่อมบำรุง เปิดได้ที่หน้ารายละเอียดทรัพย์สิน"
  }
  if (!selected) return undefined
  const link = selected.link
    ? ` · ${selected.link.kind === "machine" ? "เครื่องจักร" : "รถ"} ${selected.link.code}`
    : ""
  return `${selected.typeName} · ${selected.branchName}${link}`
}
