const AUTO_DRIVER_CODE = /^DRV-\d{4}-\d{5}$/
const AUTO_CUSTOMER_CODE = /^CUST-\d{4}-\d{5}$/

export function isAutoDriverCode(code: string | null | undefined): boolean {
  return !!code && AUTO_DRIVER_CODE.test(code)
}

export function isAutoCustomerCode(code: string | null | undefined): boolean {
  return !!code && AUTO_CUSTOMER_CODE.test(code)
}

/** Case-insensitive substring match across optional string fields. */
export function includesSearch(
  haystacks: Array<string | null | undefined>,
  query: string
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return haystacks.some((h) => (h ?? "").toLowerCase().includes(q))
}
