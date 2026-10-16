export class S3ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "S3ConfigError"
  }
}

export type S3Config = {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle: boolean
  requestTimeoutMs: number
  maxUploadBytes: number
}

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const MAX_UPLOAD_CAP_BYTES = 20 * 1024 * 1024

const REQUIRED = [
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const

function required(env: Record<string, string | undefined>, key: (typeof REQUIRED)[number]): string {
  const value = env[key]?.trim() ?? ""
  if (!value) throw new S3ConfigError(`S3 storage is not configured. Set ${key}.`)
  if (/[\r\n]/.test(value)) throw new S3ConfigError(`${key} contains a line break.`)
  return value
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase()
  if (host === "localhost" || host === "::1" || host.endsWith(".local") || host.endsWith(".internal")) {
    return true
  }
  if (!host.includes(".")) return true
  const parts = host.split(".").map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }
  const [a, b] = parts
  if (a === 10 || a === 127) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  return false
}

function parseBool(raw: string | undefined, key: string, fallback: boolean): boolean {
  if (raw == null || raw.trim() === "") return fallback
  const value = raw.trim().toLowerCase()
  if (value === "true" || value === "1") return true
  if (value === "false" || value === "0") return false
  throw new S3ConfigError(`${key} must be true or false.`)
}

function parseIntInRange(raw: string | undefined, key: string, fallback: number, min: number, max: number): number {
  if (raw == null || raw.trim() === "") return fallback
  if (!/^\d+$/.test(raw.trim())) throw new S3ConfigError(`${key} must be an integer.`)
  const value = Number(raw.trim())
  if (value < min || value > max) throw new S3ConfigError(`${key} must be between ${min} and ${max}.`)
  return value
}

export function readS3Config(env: Record<string, string | undefined> = process.env): S3Config {
  const missing = REQUIRED.filter((key) => !env[key]?.trim())
  if (missing.length > 0) {
    throw new S3ConfigError(`S3 storage is not configured. Set: ${missing.join(", ")}.`)
  }

  const endpoint = required(env, "S3_ENDPOINT")
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    throw new S3ConfigError("S3_ENDPOINT is not a valid URL.")
  }
  if (url.username || url.password) {
    throw new S3ConfigError("S3_ENDPOINT must not include credentials.")
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isPrivateHost(url.hostname))) {
    throw new S3ConfigError("S3_ENDPOINT must use https unless the host is on a private network.")
  }

  const region = required(env, "S3_REGION")
  if (!/^[a-z0-9-]{1,32}$/.test(region)) throw new S3ConfigError("S3_REGION is not a valid region name.")

  const bucket = required(env, "S3_BUCKET")
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new S3ConfigError("S3_BUCKET is not a valid bucket name.")
  }

  return {
    endpoint: url.toString().replace(/\/$/, ""),
    region,
    bucket,
    accessKeyId: required(env, "S3_ACCESS_KEY_ID"),
    secretAccessKey: required(env, "S3_SECRET_ACCESS_KEY"),
    forcePathStyle: parseBool(env.S3_FORCE_PATH_STYLE, "S3_FORCE_PATH_STYLE", true),
    requestTimeoutMs: parseIntInRange(
      env.S3_REQUEST_TIMEOUT_MS,
      "S3_REQUEST_TIMEOUT_MS",
      DEFAULT_TIMEOUT_MS,
      1000,
      120_000
    ),
    maxUploadBytes: parseIntInRange(
      env.S3_MAX_UPLOAD_BYTES,
      "S3_MAX_UPLOAD_BYTES",
      DEFAULT_MAX_UPLOAD_BYTES,
      1,
      MAX_UPLOAD_CAP_BYTES
    ),
  }
}
