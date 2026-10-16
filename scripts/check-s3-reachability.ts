import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { createObjectStorage, readS3Config, S3ConfigError, sha256Hex } from "@/modules/storage"

function loadS3Env(path: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  let text = ""
  try {
    text = readFileSync(path, "utf8")
  } catch {
    return env
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    if (!key.startsWith("S3_")) continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

async function main() {
  const env = loadS3Env(".env")
  let config
  try {
    config = readS3Config(env)
  } catch (err) {
    if (err instanceof S3ConfigError) {
      console.error(err.message)
      process.exitCode = 1
      return
    }
    throw err
  }

  const host = new URL(config.endpoint).host
  console.log(`checking host=${host} bucket=${config.bucket}`)
  const storage = createObjectStorage(config)
  await storage.headBucket()

  const body = Buffer.from(`reachability ${new Date().toISOString()}\n`)
  const key = `health-check/erp-reachability-${randomUUID()}.txt`
  await storage.putObject({ key, body, contentType: "text/plain" })
  try {
    const downloaded = await storage.getObject(key)
    if (sha256Hex(downloaded) !== sha256Hex(body)) {
      console.error("checksum mismatch after download")
      process.exitCode = 1
      return
    }
  } finally {
    await storage.deleteObject(key)
  }
  console.log("head-bucket, upload, download, and checksum succeeded")
}

main().catch((err: unknown) => {
  const name = err instanceof Error ? err.name : "Error"
  console.error(`storage check failed: ${name}`)
  console.error(
    "If the response is an HTML Cloudflare challenge, the ERP process is not reaching SeaweedFS. See docs/ops/SEAWEEDFS.md."
  )
  process.exitCode = 1
})
