export const TRANSPORT_PAYMENT_METHODS = ["cash", "credit"] as const
export type TransportPaymentMethodOption = (typeof TRANSPORT_PAYMENT_METHODS)[number]

export const TRANSPORT_PAYMENT_METHOD_LABELS: Record<TransportPaymentMethodOption, string> = {
  cash: "เงินสด",
  credit: "เครดิต",
}
