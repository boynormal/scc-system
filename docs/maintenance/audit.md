# Maintenance audit (Phase 0)

วันที่สำรวจ: 2026-10-21  
แหล่งข้อกำหนด: [Documents/maintenance-rebuild-plan.md](../../Documents/maintenance-rebuild-plan.md)  
สถานะ: เอกสารอย่างเดียว ยังไม่แก้ schema, API หรือ UI

การตัดสินใจที่ยืนยันแล้วก่อนเขียนเอกสารนี้

- ผู้รับงานและผู้ลงเวลาคือ `User` ไม่ใช่ `Personnel` ตาม [.cursor/rules/erp-people-personnel.mdc](../../.cursor/rules/erp-people-personnel.mdc)
- ~~ขอบเขตคือ `Machine` เท่านั้น~~ เปลี่ยนใน Phase 3.5 (คำสั่ง 2026-10-22): เป้าหมายของแผน PM คือทรัพย์สินในทะเบียน (`assets`) ที่เปิดสวิตช์ "เข้าแผนซ่อมบำรุง" ทุกประเภท รวมรถ เครื่องจักรและรถผูกกับทรัพย์สินได้แบบไม่บังคับ (`Machine.assetId?`, `TransportVehicle.assetId?`) ดู [implementation-plan.md](./implementation-plan.md#phase-35--pm-จากทะเบียนสินทรัพย์)
- แจ้งซ่อม (ใบงานที่ไม่ได้มาจากแผน) เลือกทรัพย์สินที่ยังใช้งานโดยไม่ต้องเปิดสวิตช์ หรือเป็นงานทั่วไปที่ไม่ผูกทรัพย์สินและเลือกแค่สาขา เครื่องจักรนับเป็นส่วนของทรัพย์สิน (คำสั่ง 2026-10-22)
- PM แบบ QR ของทะเบียนสินทรัพย์ (`AssetPmPlan`) ยังแยกชุด ไม่ยุบรวม
- คำว่า Employee ในเอกสารข้อกำหนดให้อ่านเป็น User ส่วนคำว่า Asset หลัง Phase 3.5 หมายถึงแถวใน `assets`

เอกสารคู่กัน: [data-mapping.md](./data-mapping.md), [implementation-plan.md](./implementation-plan.md)

## 1. Stack ที่ใช้จริง

| ส่วน | ของจริง |
|------|---------|
| แอป | Next.js, TypeScript, App Router |
| หน้า | `app/(dashboard)/**` |
| API | `app/api/**` เป็น route handler |
| ธุรกิจ | `modules/*/application` |
| DB | PostgreSQL ผ่าน Prisma ไฟล์เดียว `prisma/schema.prisma` |
| สิทธิ์ | session จาก `auth()` ใน `lib/auth.ts`, resource/action ใน `lib/permissions.ts`, เมทริกซ์ใน `shared/permissions/role-matrix.ts` |
| สาขา | `readBranchSharing` + `permissionCoversBranch` ใน `shared/permissions/branch-sharing.ts` |
| validate | Zod ใน application service |
| ทดสอบ | Vitest (`npm test`), ไม่มีสคริปต์ typecheck แยก ใช้ `npx tsc --noEmit` |
| ไฟล์แนบใบงาน | URL ใน JSON `images_before` / `images_after` ผ่าน `POST /api/upload` → `public/uploads` |
| แจ้งเตือน | ตาราง `notifications` และ `modules/notifications` |
| audit | ตาราง `audit_logs` เรียก `auditLog.create` ตรง ๆ ไม่มี helper กลางของ maintenance |

อย่าเพิ่ม library หรือ permission engine ใหม่ในเฟสถัดไป ใช้ของชุดนี้ก่อน

## 2. สองชุด PM ที่ห้ามยุบในเฟสนี้

| ชุด | เจ้าของ | ตาราง | หน้า |
|-----|---------|--------|------|
| ซ่อมบำรุงเครื่องจักร | Maintenance | `maintenance_plans` → `maintenance_schedules` → `work_orders.schedule_id` (ไม่บังคับ) | `/maintenance/*`, `/work-orders` |
| ทะเบียนสินทรัพย์ | Asset register | `asset_pm_plans` และรอบตรวจ QR | `/assets?tab=pm-check`, `/assets?tab=pm-calendar` |

ไม่มี foreign key ระหว่างสองชุด กฎ [erp-asset-management.mdc](../../.cursor/rules/erp-asset-management.mdc) ล็อกให้ `Machine` เป็น master ปฏิบัติการของงานซ่อม และใบงานคง `machineId`  
หลัง Phase 3.5 แผน รอบ และใบงานซ่อมบำรุงมี `assetId` เพิ่ม (`machineId` ว่างได้เมื่อทรัพย์สินไม่ได้ผูกเครื่องจักร) แต่ `asset_pm_plans` ยังไม่เชื่อมกับ `maintenance_plans`

ค่าใช้จ่ายการเงินเป็นของ Finance ไม่สร้างตาราง `MaintenanceExpense` ตาม [finance-expense-ssot.mdc](../../.cursor/rules/finance-expense-ssot.mdc) ฟิลด์ `labor_cost` / `parts_cost` บนใบงานเป็นตัวเลขปฏิบัติการ ไม่ใช่ใบ Expense

## 3. โครงสร้างปัจจุบัน

```text
Machine
  └── MaintenancePlan (frequency + type)
        └── MaintenanceSchedule   ← ทำหน้าที่ PM occurrence อยู่แล้ว
              └── WorkOrder.scheduleId   ← ไม่บังคับ และตอนนี้ไม่ถูกสร้างอัตโนมัติ
WorkOrder
  ├── WorkOrderTechnician (userId)
  ├── WorkOrderPart
  ├── ChecklistResult
  └── SparePartTransaction.workOrderId
```

ยังไม่มีตารางประวัติสถานะใบงาน, labor time entry, เหตุผลการรอ, ประเภทงาน `CORRECTIVE | PREVENTIVE | PROJECT` และ Project/Task

`MaintenanceSchedule` ไม่มี unique `(plan_id, due_date)` ตัวกันงานซ้ำอยู่แค่ `findFirst` ใน `generateMaintenanceSchedules`

## 4. หน้า, API, service

### หน้า

| เส้นทาง | ไฟล์ | สิ่งที่ทำได้วันนี้ |
|---------|------|-------------------|
| `/maintenance/plans` | `app/(dashboard)/maintenance/plans/page.tsx` | รายการแผน ปิดการใช้งานผ่าน DELETE |
| `/maintenance/plans/new` | `.../plans/new/page.tsx` | สร้างแผน |
| `/maintenance/plans/[id]` | `.../plans/[id]/page.tsx` | รายละเอียด + ตารางล่าสุด โหลด checklist template แต่ไม่แสดง |
| `/maintenance/plans/[id]/edit` | `.../plans/[id]/edit/page.tsx` | แก้แผน |
| `/maintenance/schedules` | `.../schedules/page.tsx` | รายการตาราง ลิงก์ใบงานถ้ามี |
| `/maintenance/schedules/new` | `.../schedules/new/page.tsx` | สร้างตารางมือ เรียก URL ที่ไม่มีอยู่จริง |
| `/maintenance/calendar` | `.../calendar/page.tsx` | ปฏิทินตาม `dueDate` |
| `/maintenance/master-data` | `.../master-data/page.tsx` | หมวดเครื่องจักรและประเภทงาน ต้องมีสิทธิ์ settings |
| `/work-orders` | `app/(dashboard)/work-orders/page.tsx` | รายการ ค้นหาอย่างเดียว |
| `/work-orders/new` | `.../new/page.tsx` | สร้างใบงาน ผูกตารางได้ถ้าระบุ `scheduleId` |
| `/work-orders/[id]` | `.../[id]/page.tsx` | อ่านอย่างเดียว รวมอะไหล่และผลตรวจถ้ามีแถว |
| `/work-orders/[id]/edit` | `.../[id]/edit/page.tsx` | ตั้ง status ได้ทุกค่าใน enum |

เมนูอยู่ใน `shared/navigation/moduleRegistry.ts` กลุ่มการจัดการซ่อมบำรุงใช้ resource `maintenance_plans`, `schedules`, `work_orders`, `settings`

### API

| เส้นทาง | สิทธิ์ที่ตรวจจริง |
|---------|-------------------|
| `GET/POST /api/work-orders` | `work_orders` read/create + สาขา ใน `listWorkOrders` / `createWorkOrder` |
| `GET/PATCH/DELETE /api/work-orders/[id]` | ล็อกอิน + บริษัทเดียวกัน ไม่ตรวจ resource และไม่ตรวจสาขา |
| `GET/POST /api/maintenance-plans` | ล็อกอินอย่างเดียว |
| `GET/PATCH/DELETE /api/maintenance-plans/[id]` | ล็อกอิน + บริษัทใน service อ่าน/แก้/ปิดใช้งาน |
| `GET/POST /api/schedules`, `DELETE /api/schedules/[id]` | ล็อกอินอย่างเดียว |
| `GET /api/cron/generate-schedules` | `Authorization: Bearer CRON_SECRET` |
| `GET/POST /api/master-data/maintenance-types` และ categories | GET ล็อกอิน, เขียนต้อง `settings` |
| `PATCH /api/machines/[id]` | ล็อกอิน + บริษัท `updateMachine` ไม่ได้รับ `roles` |

`POST /api/maintenance-plans` เรียก `createMaintenancePlan` โดยไม่ส่ง `companyId` service สร้างแผนจาก `machineId` ใน body โดยไม่ตรวจว่าเครื่องอยู่ในบริษัทของผู้ใช้

### Service

| ไฟล์ | หน้าที่ |
|------|---------|
| `modules/maintenance/application/maintenance-plan-service.ts` | CRUD แผน สร้าง schedule แรกตอนสร้างแผน ปิดแผนด้วย `isActive: false` |
| `modules/maintenance/application/maintenance-schedule-service.ts` | รายการ/สร้าง/ลบตาราง และ `generateMaintenanceSchedules` |
| `modules/work_orders/application/work-order-service.ts` | list/create ที่มีสิทธิ์, update/delete/หน้ารายการที่ไม่มีสิทธิ์ระดับสาขา |
| `modules/work_orders/application/generate-wo-number.ts` | เลข `WO-{year}-{nnnnn}` ต่อสาขา |
| `lib/utils.ts` `calculateNextDueDate` | บวกรอบ day/week/month/quarter/year |
| `modules/notifications/application/notification-service.ts` | `notifyWOAssigned` ถูกเรียกตอนสร้างใบงาน `notifyWOCompleted` มีฟังก์ชันแต่ไม่มีจุดเรียก |

## 5. กฎธุรกิจที่มีอยู่จริง

สถานะใบงานในฐานข้อมูล: `draft`, `open`, `in_progress`, `on_hold`, `completed`, `cancelled`

- สร้างใบงานแล้วได้สถานะ `open` เสมอ (`work-order-service.ts` บรรทัด 179) ไม่มีเส้นทาง `draft`
- `PATCH` รับ status ใดก็ได้ใน enum ไม่มี state machine
- ไม่ตั้ง `closedAt`, `approvedBy`, `approvedAt` แม้สิทธิ์ `work_orders:approve` มีในเมทริกซ์แล้ว
- ลบใบงานได้ถ้ายังไม่มีการเบิกอะไหล่ และจะลบ technician, part, checklist result ตามไปใน transaction
- ไม่เปลี่ยนสถานะเครื่อง สถานะตาราง หรือสร้าง Expense เมื่อเปิดหรือปิดงาน
- ช่างหลายคนมีตาราง `work_order_technicians` แต่ไม่มี API สร้างแถว
- ผลตรวจมีตาราง `checklist_results` แต่ไม่มี `checklistResult.create` ในโค้ด
- แผนผูก `machineId` บังคับ หนึ่งเครื่องมีได้หลายแผน
- รอบที่คำนวณได้: day, week, month, quarter, year
- `runtime_hour` เก็บใน enum และฟอร์มได้ แต่ `calculateNextDueDate` ไม่เลื่อนวัน และ cron ตัดแผนประเภทนี้ออก ไม่มีตาราง meter ของเครื่อง
- กัน schedule ซ้ำด้วยการค้น `planId + dueDate` ก่อน insert ไม่มี unique ในฐานข้อมูล
- สร้างใบงานจากตารางเป็นทางเลือกในฟอร์ม ไม่มีปุ่มจากหน้ารายการตาราง และ cron ไม่สร้างใบงาน
- ผู้รับงานคือ `User.assignedTo` ไม่ใช่ `Personnel`
- เวลาทำงานมีแค่ `actual_start` / `actual_end` / `downtime_min` ที่หัวใบงาน ไม่มี time entry รายคน
- `on_hold` ไม่มีคอลัมน์เหตุผล

สถานะตาราง: `pending`, `in_progress`, `completed`, `overdue`, `cancelled`, `skipped`  
cron เปลี่ยน `pending` ที่เลย `dueDate` เป็น `overdue` หน้ารายการตารางไม่ได้แสดงแท็บ `overdue` และ `skipped`

## 6. สิ่งที่ใช้ต่อ / ต้องปรับ / ยังไม่ใช้

| ใช้ต่อ | ต้องปรับในเฟสถัดไป | ยังไม่เลิกใช้ใน Phase 0 |
|--------|-------------------|-------------------------|
| `Machine`, `MachineCategory`, `MaintenanceType` | ตรวจสิทธิ์และบริษัทตอนสร้าง/แก้แผนและตาราง | อย่าลบ `completed` จนกว่าจะสลับไป `closed` |
| `MaintenancePlan`, `MaintenanceSchedule` | unique `(plan_id, due_date)`, บริษัทและ RBAC | อย่า drop `maintenance_schedules` เพื่อสร้าง occurrence ใหม่ |
| `WorkOrder`, `WorkOrderTechnician`, `WorkOrderPart` | state machine, ประวัติสถานะ, RBAC บน id | อย่าเปลี่ยน assignee จาก `User` เป็น `Personnel` |
| `ChecklistTemplate` ถึง `ChecklistResult` | API และ UI เพราะ schema มีแล้วแต่ไม่มีทางเขียน | อย่าสร้าง checklist ชุดที่สอง |
| `SparePart`, `SparePartTransaction` | ค่อยเชื่อมเบิกของในเฟสหลัง ไม่ใช่ Phase 1 | อย่าสร้าง stock ledger ใน maintenance |
| `AuditLog`, `Notification` | เขียนประวัติใบงานแยกจาก audit ทั่วไป | อย่าสร้างระบบแจ้งเตือนใหม่ |
| `AttendanceDay`, `AttendanceHoliday` | ใช้ประมาณกำลังคนใน Phase 4 และต้องป้ายว่าเป็นค่าประมาณ | อย่าสร้างตารางกะหรือระบบลา |
| HR `Personnel.userId` | ช่องทางเดียวที่จะผูก User กับกำลังคน | ห้ามเพิ่ม `MaintenanceTechnician` |

`AssetPmPlan` อยู่นอกขอบเขต ไม่ deprecate ในงานนี้

## 7. ช่องโหว่และบั๊กที่ต้องปิดก่อนขยาย workflow

1. `app/api/work-orders/[id]/route.ts` GET/PATCH/DELETE ไม่ตรวจ `work_orders` และไม่ตรวจสาขา ผู้ใช้ในบริษัทเดียวกันที่รู้ id แก้หรือลบได้
2. `getWorkOrdersForPage` และ `getWorkOrderDetailForPage` กรองแค่บริษัท หน้ารายการจึงกว้างกว่า `GET /api/work-orders`
3. `app/api/maintenance-plans/**` และ `app/api/schedules/**` ตรวจแค่ session ทั้งที่เมนูใช้ `maintenance_plans` และ `schedules`
4. `createMaintenancePlan` ไม่ตรวจว่า `machineId` อยู่ในบริษัทของผู้เรียก
5. `updateMachine` ไม่ตรวจสิทธิ์ `machines:update` การเปลี่ยนสถานะเครื่องจึงไม่ถูกกันที่ service
6. ไม่มี state machine `closedAt` / `approvedBy` ไม่ถูกเขียน
7. `app/(dashboard)/maintenance/schedules/new/page.tsx` บรรทัด 36 เรียก `/api/maintenance/plans/${planId}` แต่ของจริงคือ `/api/maintenance-plans/[id]`
8. หน้าเครื่องลิงก์ `/work-orders?machineId=` แต่หน้ารายการอ่านแค่ `search`
9. ปุ่ม "สร้างกำหนดการอัตโนมัติ" ที่ `schedules/page.tsx` บรรทัด 55–61 เป็นลิงก์ GET โดยไม่มี Bearer cron จะตอบ 401 และห้ามใส่ `CRON_SECRET` ฝั่งเบราว์เซอร์
10. `generateWONumber` นับแล้วค่อย insert ไม่ได้อยู่ใน transaction เดียวกับ create unique `(branch_id, wo_number)` กันเลขซ้ำได้ แต่คำขอพร้อมกันจะล้มแทนที่จะได้เลขถัดไป
11. รูปภาพใบงานอัปเดตด้วย `$executeRaw` แยกจาก `create` เพราะ Prisma create ไม่ได้ใส่ JSON ในเส้นทางนั้น

## 8. ความเสี่ยง

| ความเสี่ยง | หลักฐานวันนี้ | แนวกันในเฟสถัดไป |
|------------|----------------|------------------|
| สร้าง master ซ้ำ | มี Machine, User, Branch, Department, Supplier, MaintenanceType แล้ว | ห้ามสร้างตารางคู่ขนาน ดู data-mapping |
| ข้อมูลเก่าความหมายเปลี่ยน | สถานะ `completed` ยังไม่มีแถวใน dev แต่ enum ถูกใช้ใน UI | เพิ่ม enum ก่อน อย่า rewrite สถานะจนกว่า dry run จะผ่าน |
| ใบงานค้างบนเครื่องที่ลบแล้ว | dev: ใบงานเปิด 3 ใบอยู่บนเครื่องที่ `deleted_at` ไม่ว่าง | ห้ามลบใบงานตามเครื่อง และห้ามเปิดเครื่องกลับอัตโนมัติ |
| แผนไม่มี occurrence | dev: แผน active 7 ใบ มีตารางแค่ 1 แถว | อย่าสมมติว่าทุกแผนมี schedule |
| PM ซ้ำ | กันที่แอป ไม่มี unique ข้อมูล dev ยังไม่ซ้ำ | เติม unique หลังตรวจซ้ำในสำเนา DB |
| KPI ตีความแรงงานผิด | ไม่มี time entry รายคน | ห้ามใช้ `actual_end - actual_start` เป็นชั่วโมงแรงงาน |
| กำลังคนไม่ครบ | dev: personnel 54 แถว ผูก `user_id` แค่ 1 จาก user 5 คน | Phase 4 ต้องโชว์ว่า capacity ไม่ครบ ไม่สร้างตัวเลขปลอม |
| ข้ามสาขา | รายการ SSR และ PATCH ตาม id ไม่กรองสาขา | ปิดใน Phase 1 ก่อนเพิ่มสถานะใหม่ |
| กระทบ Finance / Asset PM / Transport | คนละตาราง | ไม่แก้ตารางเหล่านั้นใน Phase 1 |
| เวลาเซิร์ฟเวอร์กับไทย | `calculateNextDueDate` ใช้ `Date` ของโปรเซส โซนสาขาใน schema คือ `Asia/Bangkok` | กำหนดวันครบกำหนดด้วยวันที่ตามโซนสาขา ไม่ใช้ instant ของ UTC ตรง ๆ |

## 9. สิ่งที่ Phase 0 ไม่ได้ทำ

- ไม่ได้แก้ `prisma/schema.prisma` หรือ migration
- ไม่ได้รัน inventory บน production ตัวเลขใน [data-mapping.md](./data-mapping.md) มาจากฐาน dev ในเครื่องเมื่อ 2026-10-21
- ไม่ได้เขียน UI wireframe แยก หน้าเป้าหมายอยู่ใน implementation plan ข้อ 12 ของเอกสารข้อกำหนด และจะยืนยันตอนลงมือแต่ละเฟส
