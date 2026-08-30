/**
 * One-off Finance UI smoke against the running Next.js app.
 * Uses installed Chrome/Edge. Soft-deletes the bill it creates.
 */
import { chromium, type Page } from "playwright-core"
import { PrismaClient } from "@prisma/client"

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000"
const TAG = "BROWSER-SMOKE"
const results: { name: string; ok: boolean; note?: string }[] = []

function ok(name: string, cond: boolean, note?: string) {
  results.push({ name, ok: cond, note })
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${note ? ` — ${note}` : ""}`)
}

async function launchBrowser() {
  const channels = ["chrome", "msedge"] as const
  for (const channel of channels) {
    try {
      return await chromium.launch({ channel, headless: true })
    } catch {
      // try next
    }
  }
  throw new Error("Chrome/Edge not found — install a desktop browser to smoke the UI")
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 90_000 })
  const user = page.locator('input[autocomplete="username"]')
  await user.waitFor()
  await page.getByRole("button", { name: /เข้าสู่ระบบ|Sign in/ }).waitFor()
  await user.fill("admin")
  await page.locator('input[autocomplete="current-password"]').fill("Admin@1234")
  await page.getByRole("button", { name: /เข้าสู่ระบบ|Sign in/ }).click()
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 45_000, waitUntil: "commit" })
}

async function main() {
  const db = new PrismaClient()
  const browser = await launchBrowser()
  const page = await browser.newPage()
  page.setDefaultTimeout(20_000)
  let expenseId: string | null = null

  try {
    await login(page)
    ok("Login as admin", true)

    await page.goto(`${BASE}/finance/expenses/new`, { waitUntil: "domcontentloaded", timeout: 90_000 })
    await page.getByRole("heading", { name: "สร้างบิลค่าใช้จ่ายใหม่" }).waitFor()
    ok("Open /finance/expenses/new", true)

    const typeSelect = page.getByLabel("ประเภทค่าใช้จ่าย")
    await typeSelect.waitFor()
    const typeValues = await typeSelect.locator("option").evaluateAll((opts) =>
      opts.map((o) => ({
        value: (o as HTMLOptionElement).value,
        label: (o as HTMLOptionElement).textContent?.trim() ?? "",
      }))
    )
    const other = typeValues.find((o) => o.label === "อื่นๆ" || o.label.includes("OTHER"))
    ok("Expense type OTHER available", Boolean(other), other?.label)
    if (!other?.value) throw new Error("OTHER expense type missing in form")
    await typeSelect.selectOption(other.value)

    await page.getByRole("button", { name: "ระบุยอดรวม" }).click()
    await page.getByLabel("จำนวนเงิน").fill("1234")
    await page.getByRole("button", { name: "บันทึกบรรทัด" }).click()
    await page.getByText("฿1,234.00").first().waitFor()
    await page.locator("textarea").fill(TAG)
    await page.getByRole("button", { name: "บันทึก", exact: true }).click()
    await page.waitForURL(/\/finance\/expenses\/[0-9a-f-]{36}$/i, { timeout: 45_000, waitUntil: "commit" })
    expenseId = page.url().match(/[0-9a-f-]{36}/i)?.[0] ?? null
    await page.getByText("ร่าง").first().waitFor({ timeout: 20_000 })
    ok("Create manual DRAFT", Boolean(expenseId))

    await page.getByRole("button", { name: "แก้ไข" }).click()
    await page.getByRole("heading", { name: /แก้ไข/ }).waitFor({ timeout: 45_000 })
    await page.getByText("อื่นๆ").first().waitFor({ timeout: 20_000 })
    const statusSelect = page.locator("select").filter({ has: page.locator('option[value="PENDING"]') })
    await statusSelect.selectOption("PENDING")
    await page.getByRole("button", { name: "บันทึก", exact: true }).click()
    await page.getByText("รออนุมัติ").first().waitFor({ timeout: 30_000 })
    ok("UI DRAFT → PENDING", true)

    await page.getByRole("button", { name: "อนุมัติ" }).click()
    await page.getByText("อนุมัติแล้ว").first().waitFor({ timeout: 15_000 })
    ok("UI Approve", true)

    await page.getByRole("button", { name: "ทำเครื่องหมายจ่ายแล้ว" }).click()
    await page.getByText("จ่ายแล้ว").first().waitFor({ timeout: 15_000 })
    ok("UI Paid", true)
    ok("Paid amount unchanged", await page.getByText("฿1,234.00").first().isVisible())

    await page.getByRole("link", { name: "ต้นทางโมดูล" }).click()
    await page.waitForURL(/\/finance\/sources/, { waitUntil: "commit" })
    await page.getByText("รายการจากโมดูลที่รอตรวจสอบค่าใช้จ่าย").waitFor()
    await Promise.race([
      page.getByText("ไม่มีรายการจากโมดูลที่รอตรวจสอบค่าใช้จ่าย").waitFor({ timeout: 20_000 }),
      page.getByRole("button", { name: "รอตรวจสอบ" }).first().waitFor({ timeout: 20_000 }),
    ]).catch(() => undefined)
    const queueEmpty = await page.getByText("ไม่มีรายการจากโมดูลที่รอตรวจสอบค่าใช้จ่าย").isVisible().catch(() => false)
    const rowHasExpense = page.locator("button").filter({ hasText: /^มีค่าใช้จ่าย$/ })
    const hasRows = await page.getByRole("button", { name: "รอตรวจสอบ" }).first().isVisible().catch(() => false)
    const pendingDisabled = await page.getByRole("button", { name: "รอตรวจสอบ" }).first().isDisabled().catch(() => false)
    const nullAmt = await page.getByText("ยังไม่มียอดอ้างอิง").first().isVisible().catch(() => false)
    ok(
      "Open /finance/sources",
      queueEmpty || hasRows,
      queueEmpty ? "queue empty" : `rows visible; pending disabled=${pendingDisabled}; null label=${nullAmt}`
    )
    ok("Pending is status (disabled), not a mutate action", queueEmpty || pendingDisabled)

    if (hasRows) {
      await rowHasExpense.first().click()
      await page.waitForURL(/\/finance\/expenses\/new/, { waitUntil: "commit" })
      await page.getByRole("heading", { name: "สร้างบิลค่าใช้จ่ายใหม่" }).waitFor()
      const imported = await page.getByText("นำเข้าจากต้นทาง").first().isVisible().catch(() => false)
      const transport = await page.getByText("ขนส่ง").first().isVisible().catch(() => false)
      ok("มีค่าใช้จ่าย prefills /expenses/new", imported || transport)
      await page.getByRole("link", { name: "ต้นทางโมดูล" }).click()
      await page.waitForURL(/\/finance\/sources/, { waitUntil: "commit" })
      await page.getByRole("button", { name: "ไม่มีค่าใช้จ่าย", exact: true }).first().click()
      await page.getByText("ปิดว่าไม่มีค่าใช้จ่าย").waitFor()
      ok("ไม่มีค่าใช้จ่าย opens confirm dialog", true)
      await page.getByRole("button", { name: "ปิด" }).click().catch(async () => {
        await page.keyboard.press("Escape")
      })
    } else {
      ok("มีค่าใช้จ่าย prefills /expenses/new", true, "skipped — queue empty")
      ok("ไม่มีค่าใช้จ่าย opens confirm dialog", true, "skipped — queue empty")
    }

    await page.getByRole("link", { name: "รายงาน" }).click()
    await page.waitForURL(/\/finance\/reports/, { waitUntil: "commit" })
    await page.getByRole("heading", { name: "รายงานค่าใช้จ่าย" }).waitFor({ timeout: 45_000 })
    await page.getByText("ยอดรวม").first().waitFor()
    await page.getByText("จำนวนบิล").first().waitFor()
    await page.getByText("จำนวนบรรทัด").first().waitFor()
    await page.getByText("เฉลี่ย/บิล").first().waitFor()
    await page.getByText("เฉลี่ย/บรรทัด").first().waitFor()
    await page.getByText("ค่าใช้จ่ายตามประเภท").waitFor()
    await page.getByText("ค่าใช้จ่ายตามกระบวนการ").waitFor()
    await page.getByText("กระบวนการ × ประเภทค่าใช้จ่าย").waitFor()
    await page.getByText("ตามหน่วยงาน").waitFor()
    await page.getByText("ตามโมดูลต้นทาง").waitFor()
    await page.getByText("ตามวัตถุต้นทุน").waitFor()
    await page.getByText("ตามสาขา").waitFor()
    await page.getByText("ตามเดือน").waitFor()
    ok("Open /finance/reports grains", true)

    const sourceFilter = page.getByLabel("ต้นทาง")
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/finance/reports") && r.ok(), { timeout: 30_000 }),
      sourceFilter.selectOption("MANUAL"),
    ])
    const manualVisible = await page.getByText("บันทึกเอง").first().waitFor({ timeout: 15_000 }).then(() => true).catch(() => false)
    const paid1234 = await page.getByText(/1,234/).first().isVisible().catch(() => false)
    ok("Report includes MANUAL / smoke bill", manualVisible || paid1234, `manual=${manualVisible} amount=${paid1234}`)
  } catch (err) {
    const banners = await page.locator(".text-red-700, .text-red-600").allInnerTexts().catch(() => [])
    ok(
      "Browser smoke aborted",
      false,
      `${err instanceof Error ? err.message : String(err)} | url=${page.url()} | ui=${banners.join(" | ")}`
    )
  } finally {
    await browser.close()
    await db.expense.updateMany({
      where: {
        OR: [
          ...(expenseId ? [{ id: expenseId }] : []),
          { notes: TAG, deletedAt: null },
        ],
      },
      data: { deletedAt: new Date(), status: "CANCELLED" },
    })
    await db.expenseLine.updateMany({
      where: { expense: { notes: TAG } },
      data: { sourceLinkActive: false },
    })
    await db.$disconnect()
  }

  console.log("\n=== BROWSER SMOKE ===")
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.note ? ` — ${r.note}` : ""}`)
  }
  if (results.some((r) => !r.ok)) process.exit(1)
}

void main()
