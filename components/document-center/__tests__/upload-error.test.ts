import { describe, expect, it } from "vitest"
import { messageFromXhr } from "@/components/document-center/upload-error"

const fallback = "ทำรายการไม่สำเร็จ"
const expired = "เซสชันหมดอายุ"

function xhr(status: number, body: string, responseURL = ""): XMLHttpRequest {
  return { status, responseText: body, responseURL } as XMLHttpRequest
}

describe("messageFromXhr", () => {
  it("shows the server error string", () => {
    expect(messageFromXhr(xhr(503, JSON.stringify({ error: "ที่เก็บไฟล์ใช้งานไม่ได้ชั่วคราว" })), fallback, expired)).toBe(
      "ที่เก็บไฟล์ใช้งานไม่ได้ชั่วคราว"
    )
  })

  it("shows a nested error message", () => {
    expect(messageFromXhr(xhr(400, JSON.stringify({ error: { message: "ข้อมูลไม่ถูกต้อง" } })), fallback, expired)).toBe(
      "ข้อมูลไม่ถูกต้อง"
    )
  })

  it("treats a login page as an expired session", () => {
    expect(messageFromXhr(xhr(200, "<html>login</html>", "http://localhost:3000/login?callbackUrl=%2Fapi"), fallback, expired)).toBe(
      expired
    )
  })

  it("includes the status when the body is not JSON", () => {
    expect(messageFromXhr(xhr(500, "<html>error</html>"), fallback, expired)).toBe("ทำรายการไม่สำเร็จ (500)")
  })
})
