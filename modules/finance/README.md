# Module: `finance`

การเงินและบัญชี — เฟส 1: บริหารค่าใช้จ่ายและต้นทุน (Expense & Cost)

บิลค่าใช้จ่ายเป็นโครงสร้าง **Header (`expenses`) + หลายบรรทัด (`expense_lines`)**: หัวบิลถือข้อมูลระดับ
เอกสาร (สาขา/วันที่/ผู้ขาย/สถานะ) และยอดรวม (roll-up) ส่วนแต่ละบรรทัดถือประเภท จำนวน/ราคา มิติต้นทุน
และการผูกต้นทาง โดยยังไม่ทำ GL / Journal / เดบิต-เครดิต

หน้า UI: `app/(dashboard)/finance/**`
- `/finance` ภาพรวม (การ์ดสรุปตามสถานะ)
- `/finance/expenses` รายการค่าใช้จ่าย (แสดงประเภทบรรทัดแรก + "และอีก n")
- `/finance/expenses/new` · `/finance/expenses/[id]` · `/finance/expenses/[id]/edit` — ฟอร์มหน้าเต็ม + ตารางบรรทัด
- `/finance/sources` ผูกจากเอกสารต้นทาง — เลือกได้หลายรายการ (สาขาเดียวกัน) แล้ว "สร้างบิลจากที่เลือก"
- `/finance/reports` รายงานสรุปตามโมดูล/สาขา/หน่วยงาน
- `/finance/master-data` ประเภทค่าใช้จ่าย + หมวด + กระบวนการ + หน่วยงาน (Cost Center)

API: `app/api/finance/**` (thin adapter → application services)
- POST/PATCH `expenses` รับ `lines[]` (อย่างน้อย 1) — ถ้าส่ง body แบนแบบเก่า (ไม่มี `lines`) จะถูกห่อเป็น 1 บรรทัด `AMOUNT` อัตโนมัติ
- GET คืน DTO + `lines[]` + `lineCount`; ยอดหัวบิลเป็นผลรวมของบรรทัด

## แนวคิด
- บรรทัดถือการผูกต้นทางจริง: `sourceKind` (MANUAL/MODULE/IMPORT) + `sourceModule` + `sourceType` + `sourceDocumentId` + `sourceLineId`
- หัวบิล `sourceModule` เป็นค่า **derived** สำหรับกรองรายการ: โมดูลเดียวถ้าทุกบรรทัดที่ผูกเป็นโมดูลเดียวกัน, `null` ถ้าไม่มีต้นทางหรือผสมโมดูล (ไม่มี `MANUAL`/`OTHER` ใน enum แล้ว)
- Finance เป็นเจ้าของข้อมูลค่าใช้จ่ายจริง — รายงาน grain: `byType`/`byCostCenter`/`byModule` นับจาก **บรรทัด**, `byBranch`/`byMonth`/`count` นับจาก **หัวบิล**, `grandTotal` รวมจากบรรทัด (บิล 3 บรรทัด = 1 เอกสาร)
- การอ้างอิงต้นทางขนส่งอ่านผ่าน `listTransportCostSources` / `getTransportCostSourcesByIds` ของโมดูล transport (ไม่ query ตารางข้ามโมดูลตรง)

## ล็อกบรรทัดตาม `sourceKind`
- **MANUAL** (ไม่มีต้นทาง): แก้ได้ทุกช่อง
- **MODULE / IMPORT** (ผูกต้นทาง): จำนวน/หน่วย/ราคา/ยอด และฟิลด์ต้นทางถูกล็อก — เซิร์ฟเวอร์ re-derive ยอดจากโมดูลต้นทางเสมอ; แก้ได้เฉพาะประเภท/หน่วยงาน/กระบวนการ/วัตถุต้นทุน/รายละเอียด

## กันผูกต้นทางซ้ำ (Postgres)
สอง partial unique index บน `expense_lines` (สร้างด้วย SQL เพราะ Prisma ประกาศ partial unique ไม่ได้):
- `expense_lines_source_doc_uniq` — `(company_id, source_module, source_type, source_document_id)` `WHERE source_link_active AND source_document_id IS NOT NULL AND source_line_id IS NULL` (เอกสารต้นทางแบบ 1 ยอด เช่น transport log)
- `expense_lines_source_line_uniq` — เพิ่ม `source_line_id` `WHERE ... AND source_line_id IS NOT NULL` (เผื่อเอกสารหลายบรรทัดในอนาคต)

บิลมือ (ต้นทางเป็น null) ไม่เข้า index ทั้งคู่ จึงซ้ำได้ไม่จำกัด แอปเช็คซ้ำเพื่อข้อความไทย ส่วนตัวกัน race คือ unique ที่ DB
เมื่อบิลถูกยกเลิก/soft-delete จะตั้ง `source_link_active=false` เพื่อปล่อยต้นทางกลับเข้าคิวโดยยังเก็บประวัติ

## สถานะเอกสาร (`ExpenseStatus`)
`DRAFT → PENDING → APPROVED → PAID` และแยก `REJECTED` / `CANCELLED`
- อนุมัติ/ปฏิเสธ: ต้องมีสิทธิ์ `expenses.approve`
- ทำเครื่องหมายจ่ายแล้ว: ต้องมีสิทธิ์ `expenses.update` และรายการต้อง `APPROVED`
- ลบ: สิทธิ์ `expenses.delete` (soft delete + ตั้งสถานะ `CANCELLED`)

## จำนวนเงิน
คำนวณในเซิร์ฟเวอร์เสมอ ต่อบรรทัด:
- `QTY_PRICE`: `amount = round(quantity × unitPrice, 2)`
- `AMOUNT`: ใช้ `amount` ที่กรอกตรง (`quantity` = 1, `unitPrice` = `amount`)
- `netAmount = amount + taxAmount - discountAmount` (ไม่ต่ำกว่า 0)

ยอดหัวบิล = ผลรวมของทุกบรรทัด และ `postingDate` (วันที่ลงบัญชี) default = `expenseDate` แก้ได้ (รายงานยังกรองด้วย `expenseDate`)

## Phase 4 — ฟอร์มไดนามิก + ตรวจมิติบนเซิร์ฟเวอร์ (CLOSED)
กฎด้านล่างใช้กับ **create / PATCH เท่านั้น** — GET / list ต้องไม่ล้มเพราะบิลเก่า
เซิร์ฟเวอร์ (`resolveBill` → `assertLineDimensions`) เป็นแหล่งความจริง ฝั่งไคลเอนต์เป็น UX

- `requiresVendor` → หัวบิล `Expense.vendorId` (ไม่มี vendor ต่อบรรทัด) ถ้า**บรรทัดใดบรรทัดหนึ่ง**ต้องการผู้ขายแต่หัวบิลว่าง → ปฏิเสธ
- `requiresCostCenter` → `ExpenseLine.costCenterId`
- `requiresProcess` → `ExpenseLine.processId` (FK ไป `processes`)
- `requiresVehicle` / `requiresMachine` / `requiresLocation` → `costObjectType` ต้องตรง (`VEHICLE` / `MACHINE` / `LOCATION`) และ `costObjectLabel` ไม่ว่าง — ไม่มี Location master
- ประเภทที่ไม่ตรง (เช่น ต้องการรถแต่ส่ง `MACHINE`) → ปฏิเสธ
- Allowlist: ถ้าประเภทมี mapping `isAllowed` อย่างน้อย 1 รายการ ต้องเลือกจากชุดนั้น; ช่องว่างใช้ `isDefault` ถ้ามี; **ไม่มี mapping** = เลือกหน่วยงาน/กระบวนการที่ **active ของบริษัท** ได้
- `isDefault ⇒ isAllowed` ยังบังคับที่ชั้น master-data
- ประเภทมรดก (`FUEL`, `TOLL`, …) ที่ `requires_* = false` และไม่มี mapping ยังเลือกอิสระเหมือนเดิม
- บรรทัด IMPORT/MODULE: ยอดถูกล็อกจากต้นทาง แต่ประเภท / หน่วยงาน / กระบวนการ / วัตถุต้นทุน ยังแก้ได้
- `QTY_PRICE` ต้องมี `unitId` จาก Unit master ร่วม (`Settings → Basic Data → Units`) และคัดลอก `Unit.code` ไป `unitCode` เพื่อแสดงผลย้อนหลัง
- `AMOUNT`: `quantity = 1`, `unitId = null`, `unitPrice = amount` — ไม่แปลงหน่วย
- `defaultGlLabel` เป็นข้อความอ่านอย่างเดียวบนฟอร์ม — ไม่ใช่ FK และยังไม่ผ่านบัญชี

Chart of Accounts / GL FK / journal / posting ยังเลื่อนออกไป

**Phase 4 ปิดแล้ว (8/8, 2026-08-29).** หลักฐานและกฎที่ล็อกไว้: [`EXPENSE-PHASE-4-ACCEPTANCE.md`](./EXPENSE-PHASE-4-ACCEPTANCE.md) — อย่าแก้วงเหล่านี้โดยไม่มีคำสั่งจาก product

## สิทธิ์ (RBAC)
- `expenses` — รายการค่าใช้จ่าย (create/read/update/delete/approve)
- `expense_masters` — จัดการประเภท/หน่วยงาน (create/read/update/delete)
- พื้นที่ nav/layout: `finance` (ดู `module-access-catalog.ts`)

## Reporting MVP (`/finance/reports`)

รายงานอ่านอย่างเดียวจากบิลที่มีอยู่ ไม่เปลี่ยนกฎ Phase 4 และยังไม่ทำ GL

### Grain
- เงิน (`grandTotal`, `byType`, `byProcess`, `byCostCenter`, `byModule`, `byCostObject`, matrix, ยอดตามสาขา/เดือน) = `SUM(ExpenseLine.netAmount)` ของบรรทัดที่ผ่านฟิลเตอร์
- จำนวนบิล (`count` / Bills) = distinct `Expense.id` ที่เป็นเจ้าของบรรทัดเหล่านั้น
- จำนวนบรรทัด = จำนวน `ExpenseLine` ที่ผ่านฟิลเตอร์
- ช่วงเวลา = `Expense.expenseDate` (ไม่ใช้ posting date)

เมื่อกรอง Process / ประเภท / หน่วยงาน / โมดูล จะนับเฉพาะบรรทัดที่ตรง ไม่ดึงยอดทั้งบิลจากหัวเอกสาร

### สถานะที่นับ
- `deletedAt IS NULL`
- `status NOT IN (CANCELLED, REJECTED)`
- ฟิลเตอร์สถานะเพิ่มได้เฉพาะ `DRAFT | PENDING | APPROVED | PAID`

### ค่าว่าง
- Process เป็น null → `ไม่ระบุ Process`
- Cost Center เป็น null → `ไม่ระบุหน่วยงาน`
- Cost Object เป็น null → `ไม่ระบุ`
- `sourceModule` เป็น null → `บันทึกเอง` (key `MANUAL`)

### รายงานหลัก
Process × ExpenseType — ตอบว่าแต่ละกระบวนการใช้ค่าใช้จ่ายประเภทใด และเป็นจำนวนเท่าไร
คลิกแถว/เซลล์ไปที่ `/finance/expenses` พร้อมฟิลเตอร์เดิม รายละเอียดบิลยังอยู่ที่ `/finance/expenses/[id]`

