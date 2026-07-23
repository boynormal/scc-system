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

**สถานะ: Phase A + Phase B เสร็จแล้วที่ dev DB (2026-07-23)** — composite unique ด้านล่างเป็น constraint หลัก (ตัวเดียว) ที่ enforce อยู่แล้ว ของเดิม (global `@unique`) ถูกลบออกจาก schema และ DB แล้ว ยกเว้น `users.email` ที่ตัดสินใจเก็บ global ไว้ถาวร (ดูเหตุผลด้านล่าง) — migration: [`20260723130000_phase_b_drop_global_uniques`](../../prisma/migrations/20260723130000_phase_b_drop_global_uniques/migration.sql)

| ตาราง | ฟิลด์ | ปัญหาเดิม | Constraint ปัจจุบัน | สถานะ Phase B |
|-------|--------|--------|--------|--------|
| `suppliers` | `code` | `@unique` ทั้งระบบ | `@@unique([company_id, code])` เท่านั้น + `@@index([code])` | ✅ ลบ global แล้ว — `allocateUniqueSupplierCode` ใน [master-data-service.ts](../../modules/settings/application/master-data-service.ts) ปรับให้ scope ด้วย `companyId` แล้ว |
| `spare_parts` | `code` | `@unique` ทั้งระบบ | `@@unique([company_id, code])` เท่านั้น + `@@index([code])` | ✅ ลบ global แล้ว (code กรอกโดยผู้ใช้ ไม่มี auto-generator ที่พึ่ง global unique) |
| `machines` | `code` | `@unique` ทั้งระบบ | `@@unique([branch_id, code])` เท่านั้น | ✅ ลบ global แล้ว — branch scope ถาวรตามที่ตัดสินใจไว้ (2026-07-23) |
| `work_orders` | `wo_number` | `@unique` ทั้งระบบ | `@@unique([branch_id, wo_number])` เท่านั้น | ✅ ลบ global แล้ว — ตรงกับ logic ใน [generate-wo-number.ts](../../modules/work_orders/application/generate-wo-number.ts) |
| `transport_jobs` | `job_number` | `@unique` ทั้งระบบ **(gap ที่พบใหม่ — ไม่เคยมี composite ใน Phase A)** | `@@unique([company_id, job_number])` เท่านั้น + `@@index([job_number])` | ✅ ปิด gap แล้วในรอบ Phase B เดียวกัน — `generateJobNumber` ใน [job-service.ts](../../modules/transport/application/job-service.ts) นับเลขต่อ `companyId` อยู่แล้ว แต่ global unique เดิมเคย block บริษัทอื่นใช้เลขเดียวกันซ้ำ (bug แฝง) — แก้แล้ว |
| `users` | `email` | `@unique` ทั้งระบบ | **`@unique` global ยังคงไว้ถาวร** (composite ที่เคย coexist ถูกลบทิ้งเพราะซ้ำซ้อน) | ✅ **ตัดสินใจปิดแล้ว (2026-07-23): เก็บ global unique** — `lib/auth.ts` `authorize()` ค้นหา user ด้วย `email` เดี่ยว ไม่มี company selector ก่อนกรอก password ระบบยังไม่รองรับ email ซ้ำกันข้ามบริษัท ถ้าต้องการ multi-tenant email ซ้ำได้ในอนาคต ต้อง redesign login flow ก่อน (นอก scope รอบนี้) |
| `users` | `employee_code` | `@unique` ทั้งระบบ | `@@unique([company_id, employee_code])` เท่านั้น | ✅ ลบ global แล้ว (`employee_code` nullable — Postgres composite unique อนุญาตหลาย NULL ได้ตามปกติ) |

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

### 2.6 Schema drift ที่ต้องปิดงาน ✅ ปิดแล้ว (2026-07-23, ตัวเลือก A)

- **ปัญหาเดิม**: มีสคริปต์ `scripts/add-pm-columns.sql` เพิ่มคอลัมน์ `machines.pm_general`, `machines.pm_major` แบบ manual/out-of-band แต่ไม่เคยอยู่ใน Prisma model `Machine` — ทำให้ `modules/machines/application/machine-service.ts` และ `app/(dashboard)/machines/[id]/page.tsx` ต้องอ่าน/เขียนฟิลด์เหล่านี้ผ่าน raw SQL (`$queryRaw`/`$executeRawUnsafe`) แทน Prisma Client ปกติ
- **อาการที่พบจริง**: คอลัมน์เหล่านี้หายไปจาก dev DB ระหว่างทาง (สันนิษฐานว่าถูกลบตอนรัน `prisma db push` ใน DB-Phase A เพราะ `db push` reconcile DB ให้ตรงกับ schema เท่านั้น ไม่รู้จักคอลัมน์ที่เพิ่มนอก schema) → runtime error `column "pm_general" does not exist` ที่หน้า `/machines/[id]`
- **แก้แล้ว**: เพิ่ม `Machine.pmGeneral` / `Machine.pmMajor` (`@map("pm_general")` / `@map("pm_major")`) เข้า `schema.prisma` จริง, สร้าง migration [`20260723140000_add_machine_pm_columns`](../../prisma/migrations/20260723140000_add_machine_pm_columns/migration.sql) เพิ่มคอลัมน์กลับมา, ลบ raw SQL ทั้งหมดที่เกี่ยวกับฟิลด์นี้ (และฟิลด์ `machineType`/`description` ที่มีอยู่แล้วใน schema แต่ถูกดึงผ่าน raw SQL โดยไม่จำเป็น) ใน `machine-service.ts` + หน้า detail — ใช้ Prisma Client ปกติทั้งหมดแล้ว
- ลบ `scripts/add-pm-columns.sql` ทิ้ง (superseded โดย migration ที่ track ใน git)
- **หมายเหตุ**: ยังมี raw SQL อีกจุดที่ไม่เกี่ยวกับบั๊กนี้ — `modules/machines/application/machine-asset-service.ts` (CRUD ของ `machine_products`) ยังใช้ `$queryRaw`/`$queryRawUnsafe` ทั้งที่ `MachineProduct` เป็น Prisma model ที่มีอยู่แล้ว ไม่ได้แก้ในรอบนี้เพราะไม่ได้ error และอยู่นอก scope ของ Phase B — แนะนำรีแฟกเตอร์ให้ใช้ Prisma Client ปกติในรอบถัดไปเพื่อลด tech debt

---

## 3) แผน DB migration 3 เฟส (strict + ปลอดภัย)

### DB-Phase A — เตรียม + วัด + ไม่บังคับทันที ✅ เสร็จแล้ว (dev DB เท่านั้น)

- เพิ่ม **คอลัมน์ใหม่** (ถ้าต้อง backfill) เช่น `normalized_code`, หรือเตรียม unique แบบ composite คู่กับของเดิมชั่วคราว
- รัน **precheck queries**: นับ duplicate ตาม `(company_id, code)` ที่จะ enforce — ดู [scripts/precheck-tenant-uniques.sql](../../scripts/precheck-tenant-uniques.sql)
- เพิ่ม **index ช่วยค้นหา** ที่ไม่เปลี่ยน constraint ( btree ธรรมดา )

**สรุปที่ทำแล้วรอบนี้**: เพิ่ม composite `@@unique` 6 จุด (ดูหัวข้อ 2.1) ใน `schema.prisma` แบบ additive (ไม่ลบ global `@unique` เดิม) และ apply ด้วย `npx prisma db push` ที่ dev DB เท่านั้น — **ยังไม่รันกับ production**.

**อัปเดต (2026-07-23) — ทั้ง 2 business decision ปิดแล้ว:**

1. **`machines.code` scope = branch** (ถาวร) — ดูหัวข้อ 2.1 ด้านบน
2. **Migration baselining เสร็จแล้ว** — เดิม repo มี `prisma/migrations` local อยู่ 11 folder แต่ไม่เคยถูก commit เข้า git (`.gitignore` กันไว้) และไม่ครบ (ขาด migration แรกสุดที่สร้างตารางหลัก ทำให้ shadow-DB replay ของ `prisma migrate dev` ล้มเหลวเสมอ) แก้โดย:
   - รวม migration history ทั้งหมดเป็น **1 baseline migration** (`prisma/migrations/20260723000000_baseline`) ที่สร้างจาก `prisma migrate diff --from-empty --to-schema-datamodel` ครอบคลุม schema ปัจจุบันทั้งหมด (รวม composite unique 6 จุด)
   - `prisma migrate resolve --applied` เพื่อ mark ว่า apply แล้วโดยไม่กระทบ DB/ข้อมูลจริงที่มีอยู่
   - ลบ `/prisma/migrations` ออกจาก `.gitignore` แล้ว commit เข้า git — จากนี้ไปใช้ `npx prisma migrate dev` สำหรับเปลี่ยน schema แทน `db push` (ยกเว้น hotfix เร่งด่วนที่ยอมรับความเสี่ยง drift ชั่วคราว)
   - **หมายเหตุ**: `prisma migrate dev` ต้องใช้ shadow database (Postgres role ต้องมีสิทธิ์ `CREATEDB`) — ในเครื่อง dev ปัจจุบันทดสอบแล้วยังต่อ shadow DB ไม่ได้ (P1001) ต้องแก้สิทธิ์ผู้ใช้ Postgres หรือกำหนด `shadowDatabaseUrl` แยกก่อนใช้งานจริง ดู [Prisma shadow database docs](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/shadow-database)

### DB-Phase B — backfill + dedupe + enforce ✅ เสร็จแล้ว (dev DB เท่านั้น, 2026-07-23)

- **Dedupe:** ไม่ต้องทำ — global unique เดิมบังคับความไม่ซ้ำกันทั้งตารางอยู่แล้ว ทำให้ composite (ซึ่งเป็นขอบเขตที่แคบกว่า) ไม่มีทางมี duplicate ได้ตั้งแต่แรก (ยืนยันด้วย precheck SQL คืน 0 แถวทุกจุดอีกครั้งก่อนลบ)
- **ปิด gap ที่พบใหม่:** `transport_jobs.job_number` ไม่เคยมี composite unique ตั้งแต่ Phase A — เพิ่ม `@@unique([company_id, job_number])` และลบ global พร้อมกันในรอบนี้ (ดู 2.1)
- **ลบ global `@unique` เก่า** ออกจาก schema + DB จริงสำหรับ: `suppliers.code`, `spare_parts.code`, `machines.code`, `work_orders.wo_number`, `users.employee_code`, `transport_jobs.job_number`
- **ยกเว้น `users.email`** — เก็บ global unique ไว้ถาวรตามเหตุผล login flow (ดู 2.1) และลบ composite ที่เคย coexist ทิ้งเพราะซ้ำซ้อน
- **ปรับ generator ในแอป:** `allocateUniqueSupplierCode` ใน `master-data-service.ts` เปลี่ยนจาก `findUnique({ where: { code } })` (พึ่ง global unique) เป็น `findFirst({ where: { code, companyId } })` scope ตาม companyId
- **Migration:** สร้างผ่าน `prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ... --script` (workaround shadow DB ที่ยังพังอยู่) แล้ว apply ด้วย `prisma db execute --file` + บันทึกประวัติด้วย `prisma migrate resolve --applied` — ไฟล์: [`prisma/migrations/20260723130000_phase_b_drop_global_uniques/migration.sql`](../../prisma/migrations/20260723130000_phase_b_drop_global_uniques/migration.sql)
- **Verify:** `npx prisma migrate status` (up to date), `npm test` (73 tests ผ่าน), `npx tsc --noEmit` (ผ่าน หลังแก้ `prisma/seed.ts` ที่ใช้ `machine.upsert({ where: { code } })` เป็น `{ branchId_code: {...} }`), `npm run build` (ผ่าน), smoke test ผ่าน HTTP จริง (login, สร้าง supplier ใหม่ได้ code ที่ scope ตาม company, สร้าง work order ใหม่ได้ wo_number ที่ scope ตาม branch)

### DB-Phase C — cleanup + finalize

- ลบคอลัมน์ shadow / legacy index
- ทบทวน index ชุดสุดท้ายกับ `EXPLAIN` บน query หลัก
- Freeze “schema contract” สำหรับ API

---

## 4) หมายเหตุเชิงปฏิบัติการ

- ~~การเปลี่ยน `users.email` unique มีผลกับ login + session~~ — **ปิดแล้ว**: ตัดสินใจเก็บ global unique ถาวร ไม่แตะ login flow (ดู 2.1)
- **Known caveat ที่ยังไม่แก้ (นอก scope Phase B รอบนี้):** `generateWONumber`/`generateJobNumber` ยังนับเลขแบบ `count()`/`findFirst` ธรรมดา ไม่ได้ใช้ transaction + advisory lock หรือ sequence table — ถ้ามี concurrent request สร้าง WO/transport job ในสาขา/บริษัทเดียวกันพร้อมกันจริง ๆ อาจได้เลขซ้ำแล้วชน unique constraint (WO ไม่มี retry loop เหมือน transport job) ควรทำก่อนเข้า production ที่มี concurrency สูง — ดู [generate-wo-number.ts](../../modules/work_orders/application/generate-wo-number.ts), [job-service.ts](../../modules/transport/application/job-service.ts) (มี retry loop 5 ครั้งอยู่แล้ว)

---

## 5) เอกสารที่เกี่ยวข้อง

- [modular-folder-blueprint.md](./modular-folder-blueprint.md)
- [rollout-runbook.md](./rollout-runbook.md)
