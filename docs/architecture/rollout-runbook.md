# Rollout / Rollback Runbook — โค้ด 3 เฟส + DB 3 เฟส

เอกสารนี้ใช้คู่กับ:

- [modular-folder-blueprint.md](./modular-folder-blueprint.md)
- [db-blueprint.md](./db-blueprint.md)
- [contributing-modules.md](./contributing-modules.md)

**ใน repo นี้ (Phase 1 foundation):** มี `modules/*/README`, navigation tree (`link`/`group`/`section`), `buildDashboardNav` (รวม `companies.settings.nav` + RBAC), Sidebar + `/apps` launcher + command palette (Ctrl+K), `GET|PATCH /api/settings/nav-preferences` (hidden/order/pinned + hidden/reorder departments), และตัวอย่าง use-case `modules/work_orders/application/generate-wo-number.ts` — เฟสถัดไปคือย้าย logic จาก API อื่นทีละไฟล์ตาม [contributing-modules.md](./contributing-modules.md)

**อัปเดต:** `app/api/transport/**` ทั้งหมด (รวม `calendar`, `gps`, `jobs/[id]/stops`, `jobs/[id]/attachments`) ย้าย logic เข้า `modules/transport/application` ครบแล้ว ไม่มี route ที่ query Prisma ตรงเหลืออยู่ในโมดูลนี้

---

## 0) ก่อนเริ่มทุกเฟส

### Checklist

- [ ] สำรอง DB (snapshot / dump)
- [ ] ระบุ baseline: commit hash, version, env
- [ ] รายการ smoke URL (ด้านล่าง)
- [ ] เปิด maintenance window (ถ้า production)

### Smoke paths (ขั้นต่ำ)

1. `/login` → `/` dashboard
2. `/machines` list → `/machines/new` → save → `/machines/[id]`
3. `/maintenance/plans` → create/edit
4. `/maintenance/schedules` list
5. `/work-orders` → create WO
6. `/spare-parts` list → edit
7. `/settings/master-data` (categories / suppliers)
8. `/notifications`
9. `/apps` load ได้และเห็น tile ตาม role
10. Cron (ถ้ามี): `GET /api/cron/generate-schedules` with `Authorization: Bearer $CRON_SECRET`
11. `/hr/personnel` list → เพิ่มบุคลากร; `/hr/attendance` → นำเข้าไฟล์ Excel บันทึกเวลา → ลบรายการ/ลบตามวัน
12. `/transport/jobs` list; `/transport/calendar`; `/transport/map` และ `/transport/monitor` (ต้องตั้ง `GPS_API_URL`/`GPS_API_AUTH`/`GPS_ASSET_ID`)

---

## 1) Code Phase 1 — Foundation + thin adapters

### Deploy steps

1. Merge โครงสร้าง `modules/`, `shared/` (ว่างหรือมี use-case เริ่มต้น)
2. Merge `moduleRegistry` + ปรับ Sidebar ให้อ่าน registry (URL เดิม)
3. Deploy แอป — **ไม่ต้อง migrate DB** ถ้ายังไม่แตะ schema

### Verify

- [ ] Sidebar เมนูสอดคล้อง RBAC ของผู้ใช้ (เช่น Viewer ไม่เห็นเมนูตั้งค่า; Technician ไม่เห็นกลุ่มตั้งค่าเมื่อไม่มี `settings:read`) และ active state ถูกต้อง
- [ ] `/apps` tile เปิด route ได้จริง และ role ต่างกันเห็น tile ต่างกันถูกต้อง
- [ ] หลังอัปเดตสิทธิ์ role ใน DB ให้ผู้ใช้ **login ใหม่** เพื่อให้ JWT/session สะท้อนสิทธิ์ล่าสุด
- [ ] ถ้ามี role เก่าใน production ที่ยังไม่มี `notifications`/`hr_*`/`transport_*` ใน JSON — รัน `npm run db:seed` เพื่อ sync สิทธิ์ role ระบบ (`DEFAULT_ROLE_PERMISSIONS` ใน [lib/permissions.ts](../../lib/permissions.ts) ครบทุก resource แล้ว; `prisma/seed.ts` เขียนทับ `update` ทุกครั้งที่รัน — role ที่ผู้ดูแลระบบแก้ไข permission เองจะถูก reset ตาม default ด้วย ตรวจสอบก่อนรันใน production)
- [ ] Smoke paths ผ่าน

### Rollback

- Revert commit เฟส 1
- ไม่มีผล DB ถ้าไม่มี migration

---

## 2) Code Phase 2 — Domain isolation

### Deploy steps

1. ย้าย use-case โมดูลที่เหลือทีละ PR ย่อย
2. ลด logic ใน `app/api/*` ให้เหลือ adapter

### Verify

- [ ] API contract: status code + JSON shape เทียบกับ baseline (manual หรือ contract test)
- [ ] Smoke paths

### Rollback

- Revert PR ชุดที่มีปัญหา (แนะนำแยก PR ต่อโมดูล)

---

## 3) Code Phase 3 — Cleanup + governance

### Deploy steps

1. ลบ dead code ใน `app/`
2. เปิด ESLint boundaries (ถ้ามี)

### Rollback

- Revert PR governance

---

## 4) DB-Phase A — preflight + safe indexes

**สถานะ: ทำแล้วที่ dev DB เท่านั้น (ยังไม่รันกับ production)** — เพิ่ม composite `@@unique` 6 จุด (`suppliers.code`, `spare_parts.code`, `machines.code`, `work_orders.wo_number`, `users.email`, `users.employee_code`) แบบ additive คู่กับ global `@unique` เดิม ดูรายละเอียดที่ [db-blueprint.md](./db-blueprint.md#21-unique-ระดับ-global-ที่ควรย้ายเป็น-composite-company--branch)

### Deploy steps ที่ใช้จริง (dev)

1. รัน precheck SQL [scripts/precheck-tenant-uniques.sql](../../scripts/precheck-tenant-uniques.sql) ผ่าน `npx prisma db execute --file scripts/precheck-tenant-uniques.sql --schema prisma/schema.prisma` — ยืนยันว่าทุก query คืน 0 แถว (ไม่มี duplicate) ก่อน apply
2. `npx prisma db push` — apply composite unique 6 จุดจาก `schema.prisma` (repo นี้ยังไม่มี migration history แบบ commit-tracked จริง ใช้ `db push` มาตลอด ไม่ใช่ `migrate deploy`)
3. `npx prisma generate` เพื่อ sync Prisma client

### Verify

- [x] Precheck SQL คืน 0 แถวทุก query (ยืนยันแล้วที่ dev)
- [x] `prisma db push` apply สำเร็จที่ dev DB
- [ ] ไม่มี error ใน app logs (สังเกตหลัง deploy จริง)
- [ ] Smoke paths

### Business decisions — ปิดแล้ว (2026-07-23)

- **`machines.code` scope**: ตัดสินใจใช้ **branch scope** ถาวร (`@@unique([branch_id, code])`) — รหัสเครื่องจักรไม่ซ้ำภายในสาขาเดียวกัน แต่ต่างสาขาซ้ำกันได้
- **Migration baselining**: เสร็จแล้ว — รวม migration history เป็น 1 baseline migration, commit เข้า git แล้ว, ใช้ `npx prisma migrate dev` (หรือ `npm run db:migrate`) แทน `db push` สำหรับเปลี่ยน schema จากนี้ไป ดูรายละเอียดที่ [db-blueprint.md](./db-blueprint.md#3-แผน-db-migration-3-เฟส-strict--ปลอดภัย)

### Rollback

- Composite `@@unique` เป็น additive (coexist กับของเดิม) — หาก rollback ที่ dev ทำได้โดยลบ `@@unique` ที่เพิ่มใน `schema.prisma` แล้ว `npx prisma db push` อีกครั้ง
- สำหรับ production ในอนาคต: Restore DB snapshot **หรือ** migrate down ตามนโยบายทีม (Prisma ไม่มี down อัตโนมัติ — ต้องมี migration ย้อนกลับที่เตรียมไว้)

---

## 5) DB-Phase B — dedupe + enforce constraints

### Deploy steps

1. Maintenance window
2. รัน data fix script (แยก repo/script หรือ `prisma db execute`) ตาม dedupe plan
3. Deploy migration ที่เพิ่ม unique composite / ลบ unique เก่า

### Verify

- [ ] precheck duplicate = 0
- [ ] สร้างข้อมูลใหม่ที่ขอบเขตเดียวกันไม่ชน
- [ ] Smoke paths + สร้าง WO / supplier / spare part ใหม่

### Rollback

- **ต้องมี DB snapshot ก่อน Phase B** — เป็นหลัก
- ถ้า enforce แล้วพบปัญหา: restore snapshot แล้วแก้ dedupe script แล้วค่อยรันใหม่

---

## 6) DB-Phase C — cleanup

### Deploy steps

1. ลบคอลัมน์/ index ชั่วคราว
2. ทบทวน index ชุดสุดท้าย

### Rollback

- Snapshot หรือ migration ย้อนกลับที่เตรียมไว้

---

## 7) Communication template

- **Before:** แจ้ง downtime / ผลกระทบฟีเจอร์
- **After:** ลิงก์ release notes + rollback owner
