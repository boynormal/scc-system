# DB Blueprint (Strict Normalization) — โปรเจกต์นี้

อ้างอิง schema: [prisma/schema.prisma](../../prisma/schema.prisma)

เป้าหมาย: **tenant scope ชัด**, **unique ตามขอบเขตธุรกิจ**, **index ตาม workload จริง**, **FK/onDelete สอดคล้องกฎธุรกิจ**

---

## 1) จัดกลุ่มตารางตามโมดูล

### Organization

| Model | Table | หมายเหตุ |
|-------|-------|---------|
| Company | `companies` | tenant root |
| Branch | `branches` | FK `company_id` |
| Department | `departments` | FK `branch_id` |

### IAM / RBAC

| Model | Table |
|-------|-------|
| User | `users` |
| Role | `roles` |
| UserBranchRole | `user_branch_roles` |

### Machines

| Model | Table |
|-------|-------|
| MachineCategory | `machine_categories` |
| Machine | `machines` |
| MachineImage | `machine_images` |
| MachineDocument | `machine_documents` |
| MachineProduct | `machine_products` |
| MachineSparePart | `machine_spare_parts` |

### Maintenance

| Model | Table |
|-------|-------|
| MaintenanceType | `maintenance_types` |
| MaintenancePlan | `maintenance_plans` |
| MaintenanceSchedule | `maintenance_schedules` |

### Work orders

| Model | Table |
|-------|-------|
| WorkOrder | `work_orders` |
| WorkOrderTechnician | `work_order_technicians` |
| WorkOrderPart | `work_order_parts` |

### Checklist

| Model | Table |
|-------|-------|
| ChecklistTemplate | `checklist_templates` |
| ChecklistItem | `checklist_items` |
| PlanChecklistTemplate | `plan_checklist_templates` |
| ChecklistResult | `checklist_results` |

### Inventory

| Model | Table |
|-------|-------|
| Supplier | `suppliers` |
| SparePart | `spare_parts` |
| SparePartInventory | `spare_part_inventory` |
| SparePartTransaction | `spare_part_transactions` |

### Cross-cutting

| Model | Table |
|-------|-------|
| Notification | `notifications` |
| AuditLog | `audit_logs` |

---

## 2) ประเด็น normalization ที่ควรแก้ (สรุปจาก schema ปัจจุบัน)

### 2.1 Unique ระดับ global ที่ควรย้ายเป็น composite (company / branch)

**สถานะ: Phase A เสร็จแล้ว** (composite unique 6 จุดด้านล่างเพิ่มเข้า `schema.prisma` แล้ว และ apply ที่ dev DB แล้ว ผ่าน [scripts/precheck-tenant-uniques.sql](../../scripts/precheck-tenant-uniques.sql) ก่อน — ของเดิม (global `@unique`) **ยังไม่ถูกลบ**, ยังไม่ enforce composite เป็นตัวหลัก รอ Phase B)

| ตาราง | ฟิลด์ | ปัญหา | แนวทาง | สถานะ Phase A |
|-------|--------|--------|--------|--------|
| `suppliers` | `code` | `@unique` ทั้งระบบ | `@@unique([company_id, code])` | ✅ เพิ่มแล้ว (coexist กับ global unique) |
| `spare_parts` | `code` | `@unique` ทั้งระบบ | `@@unique([company_id, code])` | ✅ เพิ่มแล้ว (coexist กับ global unique) |
| `machines` | `code` | `@unique` ทั้งระบบ | `@@unique([company_id, code])` หรือ `@@unique([branch_id, code])` ตามนิยามธุรกิจ | ✅ เพิ่มแล้วเป็น `@@unique([branch_id, code])` — เลือก branch scope เพราะ `Machine` **ไม่มีคอลัมน์ `company_id`** ตรง ๆ ในตาราง (ต้อง join ผ่าน `branches`) การเพิ่ม company scope ต้องเพิ่มคอลัมน์ `company_id` ใหม่ + backfill ซึ่งอยู่นอกขอบเขต Phase A (additive only) — **ต้องตัดสินใจ business scope (company vs. branch) ก่อน Phase B** |
| `work_orders` | `wo_number` | `@unique` ทั้งระบบ | `@@unique([branch_id, wo_number])` หรือ `@@unique([company_id, wo_number])` ถ้าเลข WO ไม่ซ้ำข้ามสาขา | ✅ เพิ่มแล้วเป็น `@@unique([branch_id, wo_number])` — ตรงกับ logic จริงใน [generate-wo-number.ts](../../modules/work_orders/application/generate-wo-number.ts) ที่นับเลขแบบ scope ต่อสาขา |
| `users` | `email` | `@unique` ทั้งระบบ | ถ้าต้องการ multi-tenant จริง: `@@unique([company_id, email])` + กฎ login | ✅ เพิ่มแล้ว (coexist กับ global unique) — กฎ login (ค้นหา user ด้วย email ข้าม company) ยังไม่เปลี่ยน รอ Phase B |
| `users` | `employee_code` | `@unique` ทั้งระบบ | `@@unique([company_id, employee_code])` (nullable ต้องจัดการ partial unique) | ✅ เพิ่มแล้ว (coexist กับ global unique, `employee_code` nullable — Postgres composite unique อนุญาตหลาย NULL ได้ตามปกติ) |

### 2.2 Unique / index ที่ยังขาด (ตัวอย่าง)

| ตาราง | แนะนำ |
|-------|--------|
| `roles` | `@@unique([company_id, name])` ถ้าชื่อ role ต้องไม่ซ้ำในบริษัท |
| `maintenance_types` | `@@unique([company_id, code])` |
| `machine_categories` | `@@unique([company_id, code])` เมื่อ `code` ไม่ null — หรือ partial unique เฉพาะ code not null |
| `branches` | `@@unique([company_id, code])` |
| `work_order_technicians` | `@@unique([work_order_id, user_id])` ป้องกันซ้ำ |
| `checklist_items` | `@@unique([template_id, sequence])` |

### 2.3 Index ตาม query path (เพิ่มเมื่อยืนยัน workload)

- **Dashboard / รายงาน**: `work_orders(company via branch)`, `machines(deleted_at, branch_id, status)`, `maintenance_schedules(due_date, status, machine_id)`
- **รายการ WO**: มีแล้วบางส่วน — พิจารณา `(branch_id, status, created_at DESC)`, `(type_id, status)`
- **Inventory ledger**: `spare_part_transactions(part_id, branch_id, created_at)`
- **Notifications inbox**: มี `(user_id, is_read)` — พิจารณา `(user_id, created_at DESC)`

### 2.4 Soft delete consistency

- `machines`, `users`, `branches`, `companies` มี `deleted_at`
- ตารางอื่นที่ควร soft delete หรือ `is_active` only — ตกลงมาตรฐานเดียว (เช่น master data ใช้ `is_active` + ไม่ลบจริง)

### 2.5 FK / onDelete

- ทบทวน `onDelete` ให้สอดคล้อง: เช่น `MachineSparePart` ใช้ `Cascade` แล้ว — ตรวจ `WorkOrderPart`, `SparePartTransaction` ว่าควร `Restrict` เมื่อ WO ยังไม่ปิด

### 2.6 Schema drift ที่ต้องปิดงาน

- มีสคริปต์ [scripts/add-pm-columns.sql](../../scripts/add-pm-columns.sql) เพิ่มคอลัมน์ `machines.pm_general`, `machines.pm_major` แต่ยังไม่อยู่ใน Prisma model `Machine`
- รอบถัดไปให้เลือกแนวเดียว:
  - **A)** เพิ่มฟิลด์ใน `schema.prisma` + migration ให้ตรงกันทุก environment
  - **B)** ยกเลิกคอลัมน์ดังกล่าวและลบสคริปต์ทิ้งหากไม่ใช้งาน

---

## 3) แผน DB migration 3 เฟส (strict + ปลอดภัย)

### DB-Phase A — เตรียม + วัด + ไม่บังคับทันที ✅ เสร็จแล้ว (dev DB เท่านั้น)

- เพิ่ม **คอลัมน์ใหม่** (ถ้าต้อง backfill) เช่น `normalized_code`, หรือเตรียม unique แบบ composite คู่กับของเดิมชั่วคราว
- รัน **precheck queries**: นับ duplicate ตาม `(company_id, code)` ที่จะ enforce — ดู [scripts/precheck-tenant-uniques.sql](../../scripts/precheck-tenant-uniques.sql)
- เพิ่ม **index ช่วยค้นหา** ที่ไม่เปลี่ยน constraint ( btree ธรรมดา )

**สรุปที่ทำแล้วรอบนี้**: เพิ่ม composite `@@unique` 6 จุด (ดูหัวข้อ 2.1) ใน `schema.prisma` แบบ additive (ไม่ลบ global `@unique` เดิม) และ apply ด้วย `npx prisma db push` ที่ dev DB เท่านั้น — **ยังไม่รันกับ production**. Business decision ที่ค้างก่อนเข้า Phase B: (1) `machines.code` — company scope vs. branch scope (ปัจจุบันใช้ branch scope ชั่วคราวเพราะไม่มีคอลัมน์ `company_id`), (2) migration baselining — repo นี้ยังไม่มี migration history แบบ commit-tracked จริง (ใช้ `db push` มาตลอด) ถ้าจะ deploy composite unique ไป production ต้องตัดสินใจเรื่อง baselining ก่อน

### DB-Phase B — backfill + dedupe + enforce

- เขียน **dedupe strategy** (เลือก canonical row, อัปเดต FK ลูก, หรือเปลี่ยน code ด้วย suffix)
- เปิด **unique ใหม่** (composite)
- ลบ unique เก่า (global) เมื่อมั่นใจว่าไม่มีแถวชน
- ปรับ **generator** ในแอป (เช่น WO number, supplier auto code) ให้สอดคล้องขอบเขตใหม่

### DB-Phase C — cleanup + finalize

- ลบคอลัมน์ shadow / legacy index
- ทบทวน index ชุดสุดท้ายกับ `EXPLAIN` บน query หลัก
- Freeze “schema contract” สำหรับ API

---

## 4) หมายเหตุเชิงปฏิบัติการ

- การเปลี่ยน `users.email` unique มีผลกับ **login + session** — ต้องวาง migration พร้อมแผน login identifier
- การเปลี่ยน `wo_number` unique มีผลกับ **ฟังก์ชันสร้างเลข WO** (`generateWONumber` ใน API) — ต้องปรับให้ thread-safe (transaction + advisory lock หรือ sequence table) เมื่อ enforce `@@unique([branch_id, wo_number])`

---

## 5) เอกสารที่เกี่ยวข้อง

- [modular-folder-blueprint.md](./modular-folder-blueprint.md)
- [rollout-runbook.md](./rollout-runbook.md)
