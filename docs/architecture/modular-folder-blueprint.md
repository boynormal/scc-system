# Blueprint โครงสร้างโฟลเดอร์ (Modular Monolith) — ไม่พัง Route

เอกสารนี้กำหนด **โครงสร้างเป้าหมาย**, **กฎการย้าย**, และ **แผน 3 เฟส** สำหรับโปรเจกต์ Next.js App Router นี้ โดย **URL เดิม (`app/(dashboard)`, `app/api`) คงไว้เป็น public contract** จนกว่าจะจบเฟส 3

---

## 1) สถานะปัจจุบัน (as-is) — อ้างอิงเพื่อ mapping

| พื้นที่ | ตำแหน่งหลัก |
|--------|-------------|
| หน้า UI | `app/(dashboard)/**`, `app/(auth)/**` |
| API | `app/api/**` |
| Auth | `lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `middleware.ts` |
| Prisma / DB | `lib/prisma.ts`, `prisma/schema.prisma` |
| สิทธิ์ | `lib/permissions.ts` |
| Layout / UI ร่วม | `components/layout/**`, `components/ui/**` |

---

## 2) โครงสร้างเป้าหมาย (to-be)

ใช้แนว **Modular Monolith**: แยกโดเมนภายใน repo เดียว ไม่แยก deploy ตั้งแต่ต้น

```text
modules/
  iam/                    # ผู้ใช้, บทบาท, session boundary
    domain/
    application/
    infra/
    ui/
  machines/               # เครื่องจักร + สื่อ/สินค้าบนเครื่อง + BOM บนเครื่อง (ถ้าต้องการแยกย่อยได้ในเฟสหลัง)
    domain/
    application/
    infra/
    ui/
  maintenance/            # แผน, ตาราง, ปฏิทิน, cron generate schedules
    domain/
    application/
    infra/
    ui/
  work_orders/            # ใบสั่งงาน + technician + parts ใน WO
    domain/
    application/
    infra/
    ui/
  inventory/              # อะไหล่, ซัพพลายเออร์, สต็อก, transaction
    domain/
    application/
    infra/
    ui/
  settings/               # สาขา, master-data UI/API ที่เป็น settings
    domain/
    application/
    infra/
    ui/
  notifications/
    domain/
    application/
    infra/
    ui/
  reports/
    domain/
    application/
    infra/
    ui/
  hr/                     # บุคลากร, บันทึกเวลา, นำเข้า Excel
    application/
  transport/              # รถ, คนขับ, ใบงานขนส่ง, ปฏิทิน, GPS
    application/

shared/
  auth/                   # wrapper รอบ NextAuth / session types
  permissions/            # hasPermission, resource map (ย้ายจาก lib ได้ทีละส่วน)
  db/                       # prisma client singleton, transaction helpers
  events/                   # in-process domain events (optional เฟส 2)
  ui/                       # primitives ที่ใช้ข้ามโมดูล (หรือคง components/ui)
  utils/

app/                        # ชั้น adapter เท่านั้น — ไม่ใส่ business logic หนัก
  (dashboard)/...
  api/...
```

**กฎ import (แนะนำบังคับในเฟส 3 ด้วย ESLint):**

- `app/**` → เรียก `modules/*/application` หรือ `shared/*` เท่านั้น (ไม่ import `modules/*/infra` ตรงจาก route ถ้าไม่จำเป็น)
- `modules/*/application` → เรียก `domain` + `infra` ของโมดูลตัวเอง
- ข้ามโมดูล → ผ่าน **interface / application service** ของโมดูลปลายทาง หรือ **event** — ห้าม query ตารางโดเมนอื่นใน handler โดยตรง (เป้าหมายเฟส 2)

---

## 3) Module registry + Navigation (ไม่เปลี่ยน URL)

สร้าง `shared/navigation/moduleRegistry.ts` (หรือ `modules/_registry.ts`) เป็นที่เดียวสำหรับ:

- `key`, `label`, `icon`, `children[]` → `href` ตรงกับของเดิมใน [components/layout/sidebar.tsx](../../components/layout/sidebar.tsx)
- `permissions` → map กับ `Resource` / `Action` ใน [lib/permissions.ts](../../lib/permissions.ts)

จากนั้นให้ Sidebar อ่านจาก registry แทน array คงที่ — **path เดิมทุกตัว**

---

## 4) Mapping โฟลเดอร์เดิม → โมดูล (คร่าวๆ)

| พื้นที่ปัจจุบัน | โมดูลเป้าหมาย |
|----------------|---------------|
| `app/(dashboard)/settings/users/**`, `app/api/users/**` | `iam` |
| `app/api/master-data/roles/**` (ถ้ามองเป็น RBAC) | `iam` หรือ `settings` — เลือกหนึ่งที่ชัด; แนะนำ **iam** ถ้าเป็น role definition |
| `app/(dashboard)/machines/**`, `app/api/machines/**` | `machines` |
| `app/(dashboard)/maintenance/**`, `app/api/maintenance-plans/**`, `app/api/schedules/**`, `app/api/cron/generate-schedules/**` | `maintenance` |
| `app/(dashboard)/work-orders/**`, `app/api/work-orders/**` | `work_orders` |
| `app/(dashboard)/spare-parts/**`, `app/api/spare-parts/**` + supplier/category ที่เกี่ยว stock | `inventory` (+ บางส่วน `settings` สำหรับ master-data UI) |
| `app/(dashboard)/settings/**` (ยกเว้น users ถ้าย้ายไป iam), `app/api/master-data/**`, `app/api/settings/**` | `settings` |
| `app/(dashboard)/notifications/**`, `app/api/notifications/**`, `app/api/cron/notify/**` | `notifications` |
| `app/(dashboard)/reports/**` | `reports` |
| `app/(dashboard)/page.tsx` (dashboard) | `reports` หรือ `shared` dashboard module — ตั้งชื่อ `dashboard` เป็นโมดูลย่อยได้ถ้าต้องการ |
| `app/(dashboard)/hr/**`, `app/api/hr/**` | `hr` |
| `app/(dashboard)/transport/**`, `app/api/transport/**` | `transport` |

---

## 5) Migration โค้ด 3 เฟส (route-safe)

### เฟส 1 — Foundation + Thin adapters

**ทำ:** สร้าง `modules/`, `shared/`, registry, ย้าย use-case ชุดแรก (แนะนำ `iam` + `machines` + `maintenance` บางส่วน)

**ไม่ทำ:** ลบหรือย้ายไฟล์ใน `app/` ที่ทำให้ path เปลี่ยน

**เกณฑ์ผ่าน:** smoke ครบ — login, dashboard, machines list/detail, maintenance plan/schedule, WO สร้างได้

### เฟส 2 — Domain isolation + cross-module contracts

**ทำ:** ย้าย `work_orders`, `inventory`, `settings`, `notifications`, `reports`; ตัดการเรียก Prisma ข้ามโดเมนใน route ให้เหลือแค่ application layer

**เกณฑ์ผ่าน:** API response shape เดิม; ไม่มี regression บน spare parts, suppliers, master-data

### เฟส 3 — Cleanup + governance

**ทำ:** ลบ logic ซ้ำใน `app/api`, บังคับ import boundaries (ESLint), เอกสาร “เพิ่มโมดูลใหม่”

**เกณฑ์ผ่าน:** โครงสร้างคงที่; คู่มือ contributor พร้อม

---

## 6) ความเสี่ยงและการกันพัง

| ความเสี่ยง | แนวทาง |
|-----------|--------|
| Route พัง | ไม่ย้าย `app/(dashboard)` / `app/api` path; แค่ลดความหนา |
| Import cycle | ห้าม `modules/A` import `modules/B/infra`; ใช้ interface ใน `application` |
| Prisma client ค้าง | คง `lib/prisma.ts` หรือย้ายเป็น `shared/db/prisma.ts` แล้ว alias `@/` |
| พฤติกรรมเปลี่ยนแบบเงียบๆ | ก่อนเฟส 2 บันทึก contract สำคัญของ JSON response |

---

## 7) สถานะ implementation (Phase 1 foundation)

ทำแล้วใน repo:

- โฟลเดอร์ `modules/*` พร้อม `README.md` ต่อโมดูล
- `shared/navigation/moduleRegistry.ts` — tree เมนู (`link` / `group` / `section`) + `moduleId` / `keywords` / `order`
- `shared/navigation/buildDashboardNav.ts` — merge จาก `companies.settings.nav` + เรียงลำดับ + RBAC; [app/(dashboard)/layout.tsx](../../app/(dashboard)/layout.tsx) ส่ง `navItems` เข้า Sidebar และ Header
- `shared/navigation/filterNavByPermission.ts` — กรองเมนูตาม RBAC แบบ recursive
- Command palette (Ctrl+K) + `GET|PATCH /api/settings/nav-preferences` สำหรับอ่าน/แก้ preferences เมนูต่อบริษัท
- `shared/db`, `shared/permissions` — re-export จาก `lib/*` สำหรับโค้ดใหม่
- ตัวอย่าง use-case: [modules/work_orders/application/generate-wo-number.ts](../../modules/work_orders/application/generate-wo-number.ts) ถูกเรียกจาก [app/api/work-orders/route.ts](../../app/api/work-orders/route.ts)
- `modules/machines/application/machine-service.ts` — แยก list/create/detail/update/delete ออกจาก `app/api/machines/**` แล้ว โดย route ยังเป็น URL เดิม
- `modules/maintenance/application/maintenance-plan-service.ts` — แยก list/create/detail/update/delete maintenance plans รวมถึง auto-generate schedule แรกและ audit ตอนปิดใช้งาน
- `modules/maintenance/application/maintenance-schedule-service.ts` — แยก list/create/delete schedules รวมถึง audit ตอนลบ และคง company scope ตอน filter branch
- `modules/notifications/application/notification-service.ts` — แยก read/mark-read/generator notification ออกจาก API/cron; `lib/notifications.ts` ยังเป็น compatibility wrapper สำหรับ import เดิม
- `modules/inventory/application/spare-part-service.ts` — แยก list/create/detail/update/deactivate spare parts รวมถึง `image_url` raw SQL adapter สำหรับ Prisma client ที่ยัง stale
- `modules/settings/application/master-data-service.ts` — แยก branches, roles, categories, departments, maintenance types, suppliers และ relation lookup routes ออกจาก `app/api/master-data/**` / `app/api/settings/**`
- `modules/settings/application/nav-preference-service.ts` — แยก nav preferences read/update + permission check ออกจาก route
- `modules/machines/application/machine-asset-service.ts` — แยก images/products/spare-parts ของเครื่องจักรออกจาก `app/api/machines/[id]/**`
- `modules/iam/application/user-service.ts` — แยก users list/create/detail/update/deactivate ออกจาก `app/api/users/**`
- `modules/transport/application/*-service.ts` — ครบทั้ง jobs, vehicles, drivers, master-data, assignment ออกจาก `app/api/transport/**` (route เรียกผ่าน `modules/transport` index)
- `modules/hr/application/personnel-service.ts`, `attendance-service.ts` — แยก personnel + attendance (list/create/delete/import Excel) ออกจาก `app/api/hr/**`; `personnel-branch-utils.ts`, `parse-timesheet-xls.ts` ย้ายเข้าโมดูลเดียวกัน; `lib/personnel-branch-utils.ts` เหลือเป็น re-export wrapper ชั่วคราว

สถานะปัจจุบัน:

1. เฟส 1 ตาม blueprint เดิมปิดครบสำหรับ `iam`, `machines`, `maintenance`, `work_orders`, `inventory`, `settings`, `notifications`, `transport`, `hr`
2. `app/api/transport/calendar/**`, `app/api/transport/gps/**`, `app/api/transport/jobs/[id]/stops/**` และ `app/api/transport/jobs/[id]/attachments/**` ย้ายเข้า `modules/transport/application` ครบแล้ว (`calendar-service.ts`, `gps-service.ts`, `job-service.ts` — `listStops`/`listAttachments`/`createAttachment`) — route เหลือแค่ thin adapter ไม่มี query Prisma ตรงแล้ว
3. Role เก่าใน DB ที่ยังไม่มี `notifications` ใน JSON — เมนูแจ้งเตือนยังใช้ fallback `dashboard:read` ใน `filterNavByPermission`; รัน `npm run db:seed` อีกครั้งจะ sync สิทธิ์ role ระบบ (ดู `prisma/seed.ts`)
4. **Phase 3 (governance) ปิดแล้วสำหรับกฎ import prisma** (2026-07-23): ตรวจสอบแล้วไม่มีไฟล์ใน `app/api/**` ที่ import `@/lib/prisma` ตรงเหลืออยู่เลย — เปลี่ยน ESLint `no-restricted-imports` จาก `"warn"` เป็น `"error"` ใน `eslint.config.mjs` แล้ว (บังคับจริงจากนี้ไป ไม่ใช่แค่เตือน) ส่วน cross-module query boundary (ห้าม `modules/A` query ตาราง `modules/B` ตรง) ยังไม่มี lint rule อัตโนมัติ ต้อง code review ด้วยตาต่อไป
5. **CI เปิดแล้ว** (2026-07-23): `.github/workflows/ci.yml` รัน lint, `tsc --noEmit`, unit test, และ `next build` บนทุก push/PR เข้า `main`

เอกสารเพิ่มเติม:

- [contributing-modules.md](./contributing-modules.md) — คู่มือ contributor สั้นๆ
- [db-blueprint.md](./db-blueprint.md) — ตาราง + unique/index + แผน DB 3 เฟส
- [rollout-runbook.md](./rollout-runbook.md) — rollout / rollback / verification
