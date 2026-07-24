import { describe, expect, it } from "vitest"
import sharp from "sharp"
import { ICON_SQUARE_SIZE, isUploadProfile, processUploadBuffer } from "../image-profiles"

async function makeTestImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 10, g: 120, b: 220 },
    },
  })
    .png()
    .toBuffer()
}

describe("isUploadProfile", () => {
  it("accepts known profile values", () => {
    expect(isUploadProfile("default")).toBe(true)
    expect(isUploadProfile("productLineIcon")).toBe(true)
  })

  it("rejects unknown or missing values", () => {
    expect(isUploadProfile("something-else")).toBe(false)
    expect(isUploadProfile(null)).toBe(false)
    expect(isUploadProfile(undefined)).toBe(false)
  })
})

describe("processUploadBuffer", () => {
  it("passes the buffer through unchanged for the default profile", async () => {
    const original = await makeTestImage(300, 150)
    const result = await processUploadBuffer(original, "png", "default")

    expect(result.buffer).toBe(original)
    expect(result.ext).toBe("png")
  })

  it("crops a landscape image to a square WebP at the target icon size", async () => {
    const original = await makeTestImage(800, 300)
    const result = await processUploadBuffer(original, "jpg", "productLineIcon")

    expect(result.ext).toBe("webp")
    expect(result.contentType).toBe("image/webp")

    const meta = await sharp(result.buffer).metadata()
    expect(meta.format).toBe("webp")
    expect(meta.width).toBe(ICON_SQUARE_SIZE)
    expect(meta.height).toBe(ICON_SQUARE_SIZE)
  })

  it("crops a portrait image to a square WebP at the target icon size", async () => {
    const original = await makeTestImage(200, 900)
    const result = await processUploadBuffer(original, "png", "productLineIcon")

    const meta = await sharp(result.buffer).metadata()
    expect(meta.width).toBe(ICON_SQUARE_SIZE)
    expect(meta.height).toBe(ICON_SQUARE_SIZE)
  })

  it("throws for the icon profile when the input is not a decodable image", async () => {
    const garbage = Buffer.from("not-an-image")
    await expect(processUploadBuffer(garbage, "png", "productLineIcon")).rejects.toThrow()
  })
})
