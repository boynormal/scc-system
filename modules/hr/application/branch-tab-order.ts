const BRANCH_TAB_ORDER = ["โรงกระดาษ", "โรงเหล็ก", "พระประแดง", "โคราช", "สุราษ"]

/** เรียงแท็บสาขาตามลำดับที่ใช้ในบริษัท สาขาที่ไม่อยู่ในรายการไปต่อท้ายตามชื่อ */
export function compareBranchTabName(a: string, b: string): number {
  const rank = (name: string) => {
    const index = BRANCH_TAB_ORDER.findIndex((part) => name.includes(part))
    return index === -1 ? BRANCH_TAB_ORDER.length : index
  }
  const diff = rank(a) - rank(b)
  return diff !== 0 ? diff : a.localeCompare(b, "th")
}
