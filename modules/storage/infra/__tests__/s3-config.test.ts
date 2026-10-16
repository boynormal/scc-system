import { describe, expect, it, vi } from "vitest"
import { S3ConfigError, readS3Config } from "@/modules/storage/infra/s3-config"
import { logS3Failure } from "@/modules/storage/infra/s3-client"

const SECRET = "super-secret-value"

function env(over: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    S3_ENDPOINT: "https://s3.example.test",
    S3_REGION: "us-east-1",
    S3_BUCKET: "erp",
    S3_ACCESS_KEY_ID: "erp-app",
    S3_SECRET_ACCESS_KEY: SECRET,
    ...over,
  }
}

describe("readS3Config", () => {
  it("names missing variables and never includes secret values", () => {
    expect(() => readS3Config({ S3_SECRET_ACCESS_KEY: SECRET })).toThrow(S3ConfigError)
    try {
      readS3Config({ S3_SECRET_ACCESS_KEY: SECRET })
    } catch (err) {
      const message = err instanceof Error ? err.message : ""
      expect(message).toContain("S3_ENDPOINT")
      expect(message).toContain("S3_BUCKET")
      expect(message).not.toContain(SECRET)
    }
  })

  it("rejects public http endpoints without echoing the access key", () => {
    expect(() => readS3Config(env({ S3_ENDPOINT: "http://s3.example.test" }))).toThrow(
      /must use https/
    )
    try {
      readS3Config(env({ S3_ENDPOINT: "http://s3.example.test" }))
    } catch (err) {
      expect(err instanceof Error ? err.message : "").not.toContain(SECRET)
    }
  })

  it("allows http on localhost and defaults path style to true", () => {
    const config = readS3Config(env({ S3_ENDPOINT: "http://127.0.0.1:8333" }))
    expect(config.forcePathStyle).toBe(true)
    expect(config.endpoint).toBe("http://127.0.0.1:8333")
    expect(config.maxUploadBytes).toBe(10 * 1024 * 1024)
  })

  it("rejects an endpoint that embeds credentials", () => {
    expect(() =>
      readS3Config(env({ S3_ENDPOINT: `https://${SECRET}:hidden@s3.example.test` }))
    ).toThrow(/must not include credentials/)
  })
})

describe("logS3Failure", () => {
  it("does not log credential material or signed urls", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    logS3Failure(
      Object.assign(new Error(`failed ${SECRET} https://host/key?X-Amz-Signature=abc`), {
        name: "AccessDenied",
        $metadata: { httpStatusCode: 403 },
      })
    )
    const dumped = JSON.stringify(spy.mock.calls)
    expect(dumped).not.toContain(SECRET)
    expect(dumped).not.toContain("X-Amz-Signature")
    expect(dumped).toContain("AccessDenied")
    spy.mockRestore()
  })
})
