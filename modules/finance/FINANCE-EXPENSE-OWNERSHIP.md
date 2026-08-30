# Finance เป็น Single Source of Truth ของ Expense

**สถานะ:** Product Decision + Architecture Rule (2026-08-29)  
Phase 4 ยัง **LOCKED** — [`EXPENSE-PHASE-4-ACCEPTANCE.md`](./EXPENSE-PHASE-4-ACCEPTANCE.md)  
กฎเอเจนต์: [`.cursor/rules/finance-expense-ssot.mdc`](../../.cursor/rules/finance-expense-ssot.mdc)  
Shared Master: [`docs/architecture/erp-shared-master.md`](../../docs/architecture/erp-shared-master.md) — **Vendor = `Supplier`** ห้ามสร้าง `FinanceVendor`

> Finance เป็นเจ้าของข้อมูลค่าใช้จ่ายทางการเงินทั้งหมดของบริษัท  
> โมดูลอื่นเก็บข้อมูลปฏิบัติงานได้ แต่ห้ามสร้าง Financial Expense ซ้ำ

---

## หลักการ

```text
Operational Event → Module เจ้าของกระบวนการ → ข้อมูลปฏิบัติงาน
                                              └── optional source ──┐
                                                                     ▼
Manual Expense ──────────────────────────────────────────────► Finance Expense / ExpenseLine
                                                                     │
                                                                     ├── Approval
                                                                     ├── Payment (สถานะบิล)
                                                                     └── Reporting
```

เงินเกิดที่ไหนไม่สำคัญ — Financial Expense มีเจ้าของแห่งเดียวคือ Finance  
Finance บันทึกได้แม้ไม่มี Source จากโมดูลอื่น

---

## กฎ 10 ข้อ (ล็อก)

1. Finance เป็น Owner ของ Expense  
2. Finance เป็น Single Source of Truth ของ Financial Expense  
3. Manual Expense ต้องสร้างได้โดยไม่มี Source  
4. Operational Module เก็บ Operational Data ไม่ใช่ Financial Expense  
5. ห้ามสร้างตาราง Expense ซ้ำในโมดูลอื่น  
6. Source เป็น Optional Reference / Integration  
7. Source ไม่เป็น Dependency ของ Expense  
8. Finance ห้าม query ตารางโมดูลอื่นโดยตรง  
9. Cost Dimension ระบุว่า Expense เกี่ยวข้องกับอะไร (กฎบังคับยังเป็น Phase 4)  
10. Approval / Payment / Reporting ของ Expense อยู่ที่ Finance  

---

## ตารางความเป็นเจ้าของ

| ข้อมูล | Owner |
|---|---|
| ใบงาน / รถ / คนขับ / การเดินทาง | Transport |
| ใบซ่อม / ยาง (operational + `repairCost`/`cost`) | Transport — ไม่ใช่ Expense |
| เครื่องจักร / Work Order | Maintenance / Production (เมื่อมี) |
| Stock Movement | Inventory |
| **Expense / ExpenseLine / จำนวนเงินที่ต้องจ่าย** | **Finance** |
| ExpenseType / Cost Center / Process | Finance |
| Cost Object | ฟิลด์บนบรรทัด (ไม่ใช่ master) |
| Vendor | `Supplier` ร่วม (`Expense.vendorId`) — ไม่มีตาราง Vendor แยก |
| Approval / Payment | สถานะหัวบิล Finance |
| Expense Reporting | Finance — `SUM(ExpenseLine.netAmount)` |

ไม่มี `TransportExpense` / `MaintenanceExpense` / ตารางค่าใช้จ่ายซ้ำในโมดูลอื่น

---

## สองทางเข้าสู่บิล

```text
Manual  ──┐
          ▼
    Finance Expense
          ▲
Source ───┘  (optional)
```

| ทาง | พฤติกรรม |
|---|---|
| Manual | `/finance/expenses/new` — `sourceKind=MANUAL`, source ว่าง |
| Source | `/finance/sources` — คิวตรวจสอบจากโมดูล (ซ่อมปิด / ยางทุกใบ / ใบงานเสร็จ) แล้วเลือกมีหรือไม่มีค่าใช้จ่าย |

Workflow เดียวกัน: Expense → Approval → Payment ที่หัวบิล ไม่แยกตามโมดูล

---

## หน้าจอ

| หน้า | ความหมาย |
|---|---|
| `/finance/expenses` | รายการค่าใช้จ่ายทั้งหมดของบริษัท (manual + source) |
| `/finance/expenses/new` | ทางหลัก — บันทึกจาก Finance ได้โดยตรง |
| `/finance/sources` | คิวตรวจสอบจากโมดูล — **ไม่ใช่** รายการค่าใช้จ่ายทั้งหมด |
| `/finance/reports` | รายงานจาก ExpenseLine ชุดเดียว รวม MANUAL |

คิวว่างได้เพราะยังไม่มีต้นทางที่พร้อมตรวจ, ถูกบันทึกบิลแล้ว, ปิดว่าไม่มีค่าใช้จ่าย, หรือไม่มีสิทธิ์ — ห้ามสื่อว่า «ต้นทุนทั้งหมดถูกบันทึกแล้ว»

Finance-ready: Repair `closed`, Tire log ทุกใบ (ไม่มีสถานะเพิ่ม), Job `completed` (1 job = 1 แถว, ไม่แตกตามจุดรับ/ส่ง)  
ไม่ใช้จำนวนเงินเป็นเงื่อนไขเข้าคิว — `null` / `0` / `>0` แยกความหมาย  
`NO_EXPENSE` ปิดคิวโดยไม่สร้างบิล 0 บาท — ยกเลิกบิลเปิดกลับเฉพาะ `EXPENSE_CREATED`

TRANSPORT source ยังไม่รวมน้ำมัน / ทางด่วน (บันทึก manual ได้)

---

## Acceptance (สถาปัตยกรรม)

| ID | เกณฑ์ | ระบบ |
|---|---|---|
| AC-01 | Manual โดยไม่มี source | ผ่าน |
| AC-02 | `source = null` ได้ | ผ่าน |
| AC-03 | Transport ไม่ต้องมี Financial Expense | ผ่าน |
| AC-04 | Maintenance ยังไม่พร้อม ไม่บล็อกการลงค่าซ่อม | ผ่าน |
| AC-05 | ไม่มีตาราง Expense ซ้ำ | ผ่าน |
| AC-06 | Reporting ใช้ Finance เป็น SSOT | ผ่าน |
| AC-07 | Approval ที่หัวบิล | ผ่าน |
| AC-08 | Payment ที่หัวบิล (`PAID`) | ผ่าน |
| AC-09 | Source เป็น optional | ผ่าน |
| AC-10 | Phase 4 validation ไม่เปลี่ยน | ผ่าน — ไฟล์ล็อก |

---

## สิ่งที่ห้าม

- ตาราง Expense ต่อโมดูล, บังคับ source ก่อนสร้างบิล  
- บังคับให้ Maintenance/Transport พร้อมก่อน Finance ลงเงิน  
- Finance query ตารางโมดูลอื่นตรง  
- เปลี่ยน Phase 4 validation  
- Source adapter ใหม่หรือ GL / CoA / journal โดยไม่มี Product Decision  

---

## ลำดับงาน

Transport อาจเก็บ **ยอดอ้างอิง** (`repairCost` / tire `cost`) — ไม่ใช่ Expense  
ยอดอ้างอิง `> 0` ใช้ prefill/lock ตามเดิม; `null`/`0` ให้ Finance กรอกเอง  
Finance ยังเป็นเจ้าของยอดที่ต้องจ่าย / อนุมัติ / จ่ายแล้ว

| งาน | สถานะ |
|---|---|
| Expense core / master / lines / Unit / Phase 4 / Reporting / Transport source | เสร็จ |
| ล็อกกฎ SSOT + สำนวน sources/แท็บ + UX ฟอร์ม manual | เสร็จ |
| Transport UI: ยอดอ้างอิง optional ไม่เรียกว่าค่าใช้จ่าย | เสร็จ |
| Finance Review Queue (`finance_source_reviews`) | เสร็จ |
| ใช้งานจริง / feedback workflow | ถัดไป |
| Maintenance module แล้วค่อย adapter | แยกงาน |
| GL / CoA / Journal | รอ Product Decision |
