export const FETCH_TIMEOUT_MS = 30_000
export const USER_AGENT = "scc-system/raw-material-news"

type NextFetchInit = RequestInit & { next?: { revalidate?: number } }

function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms)
  }
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller.signal
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const name = "name" in err ? String((err as { name?: unknown }).name) : ""
  return name === "TimeoutError" || name === "AbortError"
}

export async function fetchUpstream(
  url: string,
  options: { revalidate: number; accept?: string }
): Promise<Response> {
  const init: NextFetchInit = {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: options.accept ?? "text/html,application/json;q=0.9,*/*;q=0.8",
    },
    signal: timeoutSignal(FETCH_TIMEOUT_MS),
    next: { revalidate: options.revalidate },
  }
  try {
    return await fetch(url, init)
  } catch (err) {
    if (isAbortError(err)) {
      throw new Error("หมดเวลารอการตอบกลับจากแหล่งข้อมูล")
    }
    throw err
  }
}

export async function fetchUpstreamText(url: string, revalidate: number): Promise<string> {
  const res = await fetchUpstream(url, { revalidate, accept: "text/html,application/xhtml+xml" })
  if (!res.ok) throw new Error(`แหล่งข้อมูลตอบกลับ ${res.status}`)
  return res.text()
}

export async function fetchUpstreamJson<T>(url: string, revalidate: number): Promise<T> {
  const res = await fetchUpstream(url, { revalidate, accept: "application/json" })
  if (!res.ok) throw new Error(`แหล่งข้อมูลตอบกลับ ${res.status}`)
  return (await res.json()) as T
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
