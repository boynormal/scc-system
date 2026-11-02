export function messageFromXhr(xhr: XMLHttpRequest, fallback: string, sessionExpired: string): string {
  if (xhr.status === 401 || (xhr.responseURL || "").includes("/login")) return sessionExpired
  try {
    const body = JSON.parse(xhr.responseText) as { error?: unknown }
    if (typeof body.error === "string" && body.error.trim()) return body.error
    if (body.error && typeof body.error === "object" && "message" in body.error) {
      const message = (body.error as { message?: unknown }).message
      if (typeof message === "string" && message.trim()) return message
    }
  } catch {
    // HTML or an empty body has no error string to show.
  }
  if (xhr.status > 0) return `${fallback} (${xhr.status})`
  return fallback
}
