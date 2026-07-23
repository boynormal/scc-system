const AUTO_DRIVER_CODE = /^DRV-\d{4}-\d{5}$/
const AUTO_CUSTOMER_CODE = /^CUST-\d{4}-\d{5}$/

export function isAutoDriverCode(code: string | null | undefined): boolean {
  return !!code && AUTO_DRIVER_CODE.test(code)
}

export function isAutoCustomerCode(code: string | null | undefined): boolean {
  return !!code && AUTO_CUSTOMER_CODE.test(code)
}
