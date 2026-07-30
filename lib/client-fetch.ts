const DEFAULT_TIMEOUT_MS = 30_000

export class ClientFetchError extends Error {
  readonly status?: number
  readonly code?: string
  readonly timedOut: boolean

  constructor(
    message: string,
    options?: { status?: number; code?: string; timedOut?: boolean; cause?: unknown }
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = "ClientFetchError"
    this.status = options?.status
    this.code = options?.code
    this.timedOut = options?.timedOut ?? false
  }
}

type FetchJsonInit = RequestInit & { timeoutMs?: number }

function mergeAbortSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      return controller.signal
    }
    signal.addEventListener(
      "abort",
      () => {
        controller.abort(signal.reason)
      },
      { once: true }
    )
  }
  return controller.signal
}

function messageFromBody(body: unknown, fallback: string): { message: string; code?: string } {
  if (!body || typeof body !== "object") return { message: fallback }
  const record = body as Record<string, unknown>
  const code = typeof record.code === "string" ? record.code : undefined
  const error = record.error
  if (typeof error === "string" && error.trim()) return { message: error, code }
  if (error && typeof error === "object" && "message" in error) {
    const nested = (error as { message?: unknown }).message
    if (typeof nested === "string" && nested.trim()) return { message: nested, code }
  }
  return { message: fallback, code }
}

/**
 * Browser fetch helper: JSON parse, API error shape, and default 30s timeout.
 */
export async function fetchJson<T>(input: RequestInfo | URL, init: FetchJsonInit = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: userSignal, ...rest } = init
  const timeoutController = new AbortController()
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs)

  const signal = userSignal
    ? mergeAbortSignals([userSignal, timeoutController.signal])
    : timeoutController.signal

  try {
    let res: Response
    try {
      res = await fetch(input, { ...rest, signal })
    } catch (err) {
      if (timeoutController.signal.aborted && !userSignal?.aborted) {
        throw new ClientFetchError("หมดเวลารอการตอบกลับ", { timedOut: true, cause: err })
      }
      if (userSignal?.aborted) {
        throw new ClientFetchError("การร้องขอถูกยกเลิก", { cause: err })
      }
      throw new ClientFetchError("เกิดข้อผิดพลาดในการเชื่อมต่อ", { cause: err })
    }

    let body: unknown = null
    const contentType = res.headers.get("content-type") ?? ""
    if (contentType.includes("application/json")) {
      try {
        body = await res.json()
      } catch {
        body = null
      }
    } else {
      try {
        const text = await res.text()
        body = text ? { error: text } : null
      } catch {
        body = null
      }
    }

    if (!res.ok) {
      const { message, code } = messageFromBody(body, `คำขอไม่สำเร็จ (${res.status})`)
      throw new ClientFetchError(message, { status: res.status, code })
    }

    return body as T
  } finally {
    clearTimeout(timer)
  }
}
