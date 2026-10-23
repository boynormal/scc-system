# Maintenance implementation plan

วันที่: 2026-10-21  
อิง [audit.md](./audit.md) และ [data-mapping.md](./data-mapping.md)  
ข้อกำหนดต้นทาง: [Documents/maintenance-rebuild-plan.md](../../Documents/maintenance-rebuild-plan.md)

Phase 0 จบที่เอกสารชุดนี้ ห้ามเริ่ม Phase 1 จนกว่าจะมีการสั่งให้ทำเฟสนั้น  
ทำทีละเฟส แต่ละเฟสต้องผ่าน exit criteria ของตัวเองก่อนเปิดเฟสถัดไป

ขอบเขตที่ล็อกแล้ว: ผู้ปฏิบัติงานคือ `User`, งานซ่อมอยู่บน `Machine`, ไม่ยุบ Asset PM, ไม่สร้าง Expense ในโมดูลนี้, ไม่สร้าง Personnel/Department/Supplier/Branch ซ้ำ

## สิ่งที่เลิกใช้เมื่อเฟสที่ระบุผ่านแล้ว

| พฤติกรรม | เลิกเมื่อ | แทนด้วย |
|----------|----------|---------|
| PATCH ตั้ง `status` อะไรก็ได้ | Phase 1 | `transitionWorkOrder` |
| หน้ารายการใบงานที่ไม่กรองสาขา | Phase 1 | ใช้กติกาเดียวกับ `listWorkOrders` |
| ลิงก์ `/api/maintenance/plans/:id` | Phase 1 | `/api/maintenance-plans/:id` |
| ปุ่ม cron บนหน้าตารางที่ไม่มี Bearer | Phase 1 | เอาลิงก์ออก งาน cron อยู่ที่ scheduler |
| ใช้ `actual_end - actual_start` เป็นชั่วโมงคน | Phase 2 | ผลรวม time entry ประเภท `work` |
| สร้าง occurrence ซ้ำได้เพราะไม่มี unique | Phase 3 | unique `(plan_id, due_date)` |
| ฟอร์มที่ยังส่ง `completed` | หลัง switch ในเฟส contract | `closed` |

ยังไม่ลบตารางหรือ enum เก่าใน Phase 1

## Phase 1 — ใบงานแกนและสิทธิ์

เป้าหมาย: ปิดช่องข้ามสาขา และให้การเปลี่ยนสถานะมีประวัติ ยังไม่ทำจับเวลา ไม่ทำ PM อัตโนมัติ ไม่ทำโครงการ

### ไฟล์ที่แก้

- `prisma/schema.prisma` เพิ่มค่า `WorkOrderStatus`: `assigned`, `ready_for_handover`, `handed_over`, `closed` คง `completed` ไว้ เพิ่มโมเดลประวัติสถานะ และคอลัมน์ `work_kind` (`corrective | preventive | project`) ที่ว่างได้
- migration ใหม่ใต้ `prisma/migrations/` แบบ additive
- `app/api/work-orders/route.ts` และ `app/api/work-orders/[id]/route.ts` ส่ง `roles` เข้า service และใช้ `withAuth` ตามแนว route ใหม่
- `app/api/maintenance-plans/route.ts`, `app/api/maintenance-plans/[id]/route.ts`
- `app/api/schedules/route.ts`, `app/api/schedules/[id]/route.ts`
- `app/api/machines/[id]/route.ts` ให้ `updateMachine` / `deleteMachine` ตรวจ `machines` update/delete และสาขา
- `modules/work_orders/application/work-order-service.ts` เลิกให้หน้า SSR ข้ามสาขา
- `modules/maintenance/application/maintenance-plan-service.ts` ตรวจเครื่องและประเภทงานอยู่ในบริษัท
- `modules/machines/application/machine-service.ts` รับ `roles` ใน update/delete
- `app/(dashboard)/maintenance/schedules/new/page.tsx` เปลี่ยน URL ที่เรียกผิด
- `app/(dashboard)/maintenance/schedules/page.tsx` เอาลิงก์ cron ออก
- `app/(dashboard)/work-orders/page.tsx` อ่าน `machineId` ที่หน้าเครื่องส่งมา
- `modules/work_orders/application/generate-wo-number.ts` จองเลขใน transaction เดียวกับ insert

### ไฟล์ที่เพิ่ม

- `modules/work_orders/application/work-order-transitions.ts` กติกาเปลี่ยนสถานะและเขียน `work_order_status_history` ใน transaction เดียว
- `modules/work_orders/application/__tests__/work-order-transitions.test.ts`
- ขยาย `modules/work_orders/application/__tests__/work-order-service.test.ts` ให้ครอบคลุม update/delete ที่ถูกปฏิเสธเมื่อคนละสาขา

### กติกาสถานะในเฟสนี้

อนุญาตอย่างน้อย: `open → assigned → in_progress → on_hold → in_progress → ready_for_handover → handed_over → closed` และ `→ cancelled` จากสถานะที่ยังไม่ปิด  
`on_hold` ต้องมีเหตุผล ใช้ค่า `waiting_part`, `waiting_user`, `waiting_approval`, `waiting_machine_stop`, `waiting_external`, `other`  
ปิดหรือยกเลิกไม่ได้ถ้าเฟสหลังมีช่วงเวลาเปิดค้าง เฟสนี้ยังไม่มี time entry จึงยังไม่บังคับข้อนั้น  
ห้ามให้การปิดใบงานไปตั้ง `Machine.status`  
`work_orders:approve` ใช้กับการรับมอบ (`handed_over` → `closed`) และการยกเลิก ผู้ที่ไม่มีสิทธิ์ approve ยังทำงานถึง `ready_for_handover` ได้  
ส่งกลับแก้ไขอยู่ที่ใบงานเดิม บันทึกเหตุผลในประวัติ แล้วกลับไป `in_progress`

การ map แถวเก่าทำตาม [data-mapping.md](./data-mapping.md) บนสำเนาฐาน ไม่ทำใน migration ที่รันอัตโนมัติทุกสภาพแวดล้อมจนกว่า dry run จะผ่าน

### จบ Phase 1 เมื่อ

- ผู้ใช้สาขา A อ่านหรือแก้ใบงานสาขา B ไม่ได้ ทั้ง API และหน้า SSR
- ผู้ที่ไม่มีสิทธิ์โมดูลเรียก plans/schedules/work orders ไม่ได้
- ทุก transition ที่อนุญาตมีแถวประวัติ และ transition ที่ห้ามถูกปฏิเสธ
- `npm test` ของ work order ผ่าน, `npx tsc --noEmit` ผ่าน
- โมดูล finance, assets, transport, hr ไม่ถูกแก้ schema

## Phase 2 — จับเวลา

ตาราง `work_order_labor_entries` อ้าง `user_id` และ `work_order_id` ชนิดช่วง `work | wait | travel` เหตุผลการรอเฉพาะช่วง `wait`  
เวลาเริ่มและจบมาจากเซิร์ฟเวอร์ ผู้มีสิทธิ์ `work_orders:update` กดแทนช่างคนใดก็ได้ที่อยู่ใน `work_order_technicians` หรือเป็น `assigned_to`  
ช่างหนึ่งคนมีช่วงเปิดได้ครั้งละหนึ่งช่วงทั้งบริษัท ถ้าเริ่มใบงานอื่น ระบบปิดช่วงเดิมให้อัตโนมัติ (`auto_close`)  
การแก้ย้อนหลังและการเพิ่มช่วงที่ลืมกดต้องมีเหตุผล ต้องไม่ซ้อนกับช่วงอื่นของคนเดียวกัน และเขียน `audit_logs` ที่ `table_name = work_order_labor_entries`  
ห้ามส่งมอบ ส่งต่อ ปิด หรือยกเลิกใบงานขณะยังมีช่วงที่ `ended_at` ว่าง

ไฟล์หลัก: `work-order-labor-service.ts`, `work-order-technician-service.ts`, route ใต้ `app/api/work-orders/[id]/labor` และ `/technicians`, แผงจับเวลาบน `app/(dashboard)/work-orders/[id]/page.tsx`  
รายงานภาระงานข้ามใบงานยังไม่ทำในเฟสนี้ ใช้ `summarizeLabor` ต่อใน Phase 5 เมนูปรับใน Phase 3 แล้ว

จบเมื่อชั่วโมง `work` ไม่รวมช่วง `wait`, คนเดียวกันช่วงซ้อนถูกปฏิเสธ, หลายคนบนใบเดียวกันได้คนละแถว, และปิดงานไม่ได้ถ้ายังมีช่วงที่ `ended_at` ว่าง

## Phase 3 — PM ของเครื่อง

ใช้ `maintenance_schedules` เป็น occurrence อย่าสร้างตารางคู่  
Migration `20261021180000_maintenance_phase3_pm` เพิ่ม unique `(plan_id, due_date)`, `work_orders.schedule_id` unique (หนึ่งรอบมีใบ PM ใบเดียว), `source_work_order_id` และ `source_checklist_result_id` (unique) บนใบงาน, และให้ `checklist_results.status` กับ `recorded_at` ว่างได้ (ว่าง = ยังไม่ตรวจ, `na` = ผู้ใช้เลือกไม่เกี่ยวข้อง) พร้อม unique `(work_order_id, item_id)` ถ้ามีแถวซ้ำ migration จะล้ม ไม่เขียนทับ

**Generator** อยู่ที่ `modules/maintenance/application/pm-generator.ts`  
ทำทีละแผนใน transaction ที่ถือ `pg_advisory_xact_lock('pm:'||plan_id)` สร้างรอบภายใน lead time ด้วย `createMany(skipDuplicates)` แล้วสร้างใบ `preventive` สถานะ `open` พร้อมแถวประวัติ และแถว `checklist_results` ว่างหนึ่งแถวต่อข้อของ template ที่ใช้งานอยู่และผูกกับแผน  
ข้ามแผน `runtime_hour`, แผนที่ปิดใช้ และเครื่องที่ถูกลบ รอบที่ครบกำหนดก่อนวันสร้างแผนไม่ถูกสร้างย้อนหลัง  
Cron เดิมเรียก `generateMaintenanceSchedules` ทั้งระบบ ปุ่ม "สร้างรอบและใบ PM" บนปฏิทินเรียก `POST /api/schedules/generate` ซึ่งทำเฉพาะสาขาที่ผู้ใช้มี `schedules:create`  
การสร้างแผนและการเพิ่มรอบเอง (`/maintenance/schedules/new`) ใช้ generator ตัวเดียวกัน ใบงานที่สร้างมือรับ `scheduleId` ไม่ได้แล้ว

**Checklist** ใช้ `ChecklistTemplate`, `ChecklistItem`, `PlanChecklistTemplate` เดิม  
API `app/api/maintenance/checklists` (GET: `settings:read` หรือ `maintenance_plans:read`, POST/PATCH: `settings:update`) แท็บ "แม่แบบรายการตรวจ" ในข้อมูลพื้นฐาน ฟอร์มแผนเลือก template ได้ (`templateIds`)  
แม่แบบที่มีผลตรวจแล้วแก้รายการตรวจไม่ได้ (409) ให้สร้างใหม่แล้วปิดใช้ของเดิม  
แผงรายการตรวจบนใบงาน (`work-order-checklist-panel.tsx`, `POST /api/work-orders/[id]/checklist`, สิทธิ์ `work_orders:update`) บันทึกได้จนถึง `ready_for_handover`  
ข้อ `isRequired` ที่ยังว่างกันการเปลี่ยนไป `ready_for_handover`, `handed_over`, `closed`, `cancelled` ในจุดเดียวกับกันจับเวลาค้าง  
ใบ PM ที่ส่งมอบหรือปิดทำให้รอบเป็น `completed` ยกเลิกทำให้รอบเป็น `cancelled`

**ใบซ่อมจากข้อที่ไม่ผ่าน** `fail` ครั้งแรกของข้อนั้นสร้างใบ `corrective` ใบเดียวใน transaction เดียวกัน (เครื่อง สาขา ประเภท ความสำคัญเดียวกับใบ PM) ชี้ `source_work_order_id` และ `source_checklist_result_id` บันทึก fail ซ้ำหรือเปลี่ยนเป็นผ่านไม่สร้างหรือลบใบซ่อม ใบ PM แสดงรายการใบซ่อม ใบซ่อมแสดงลิงก์กลับใบ PM

**PM compliance** `getPMCompliance` ใน `modules/maintenance/application/pm-compliance.ts` เป็นที่เดียวที่คำนวณ  
ตัวตั้ง: ใบ PM ที่เข้าสถานะ `handed_over` หรือ `closed` ครั้งแรกภายในสิ้นวันครบกำหนด  
ตัวหาร: รอบที่ครบกำหนดก่อนวันนี้ในช่วงนั้น บวกรอบที่ครบวันนี้และเสร็จแล้ว (งานเลยกำหนดและยังไม่เสร็จนับด้วย)  
รอบที่ยกเลิก ข้าม หรือเครื่องถูกลบไม่เข้าตัวหาร แต่คืนจำนวนแยกตามเหตุผล  
หน้า `/maintenance/calendar` แสดงตัวเลขของเดือนที่เปิด กดตัวเลขแล้วกรองรายการถึงกำหนดด้านล่าง เมนู "ตารางงาน" ถูกเอาออก `/maintenance/schedules` redirect มาหน้านี้

ยังไม่เปิด `runtime_hour` จนกว่าจะมีแหล่ง meter ที่สั่งแยก (ฟอร์มไม่แสดง และ API สร้าง/เปลี่ยนเป็นค่านี้ไม่ได้)

ผลตรวจ 2026-10-21: `npm test` 62 ไฟล์ 512 เทสผ่าน (เทสใหม่ 22: generator ซ้ำ, ข้าม `runtime_hour`, fail สร้างใบซ่อมใบเดียว, ข้อบังคับว่างส่งมอบ/ยกเลิกไม่ได้, คนละสาขาถูกปฏิเสธ, ตัวหาร compliance), `npx tsc --noEmit` เหลือเฉพาะ error เดิมของ `expense-phase4-acceptance.test.ts`, lint ไม่มี error ใหม่, smoke ด้วย admin ทั้ง API และเบราว์เซอร์ผ่าน แล้วลบข้อมูลทดสอบ จำนวนแถวโมดูลอื่นไม่เปลี่ยน

จบเมื่อรัน generator ซ้ำแล้วจำนวน schedule และใบงานไม่เพิ่ม, ใบ PM ชี้กลับแผนและ schedule ได้, และนิยาม PM compliance อยู่ใน service เดียวกับรายงาน

## Phase 3.5 — PM จากทะเบียนสินทรัพย์

คำสั่ง 2026-10-22 ทะเบียน `assets` เป็นต้นทางเดียวของสิ่งที่เข้าแผน PM ทุกประเภท (เครื่องจักร รถ และอื่น ๆ) เงื่อนไขเดียวกันทุกแถว

Migration `20261022100000_maintenance_phase35_asset_pm`  
`assets.maintenance_pm_enabled` (สวิตช์ "เข้าแผนซ่อมบำรุง" แยกจาก PM แบบ QR), `machines.asset_id` และ `transport_vehicles.asset_id` (unique, `SET NULL`), `asset_id` บน `maintenance_plans` / `maintenance_schedules` / `work_orders` (`RESTRICT`) และ `machine_id` บนสามตารางนี้ว่างได้ โดยมี CHECK `machine_id IS NOT NULL OR asset_id IS NOT NULL` แถวเดิมผ่านทั้งหมด

**ทรัพย์สิน** (`modules/assets/application/asset-maintenance-service.ts`, `/api/assets/[id]/maintenance`, การ์ดบนหน้ารายละเอียดและหน้าแก้ไข)  
เปิดสวิตช์ได้เฉพาะทรัพย์สินที่ใช้งานและไม่ใช่ `RETIRED` / `DISPOSED` ปิดใช้ ปลดระวาง หรือลบทรัพย์สินแล้วสวิตช์ปิดเอง  
ผูกเครื่องจักรหรือรถได้หนึ่งรายการ บริษัทและสาขาเดียวกัน และรายการนั้นยังไม่ถูกผูกที่อื่น ทุกครั้งเขียน `audit_logs` ไม่สร้างทรัพย์สินจากเครื่องหรือรถอัตโนมัติ  
รายการ `/assets` มีตัวกรองและป้าย "เข้าแผนซ่อมบำรุง"

**แผน รอบ ใบงาน** แผนใหม่ต้องเลือกทรัพย์สินที่เปิดสวิตช์ (`GET /api/maintenance/pm-assets`) ถ้าทรัพย์สินผูกเครื่องจักร ระบบเติม `machineId` ให้ หน้าเครื่อง อะไหล่ และประวัติเดิมจึงยังเห็นงาน  
สาขาของรอบและใบงานใช้สาขาของทรัพย์สิน แผนเดิมที่มีแค่ `machineId` ยังสร้างรอบและแก้ไขได้ และย้ายเข้าทรัพย์สินได้จากหน้าแก้ไขแผน  
Generator ข้ามแผนเมื่อทรัพย์สินปิดสวิตช์ ถูกลบ ไม่ active หรือปลดระวาง (กติกาเครื่องถูกลบยังใช้กับแผนเก่า)  
ใบซ่อมจากข้อตรวจไม่ผ่านคัดลอก `assetId` และ `machineId` จากใบ PM **ทุกประเภทรวมรถเปิดเป็นใบ corrective ในซ่อมบำรุง ไม่สร้าง `transport_repair_logs`**  
แจ้งซ่อม (คำสั่ง 2026-10-22 ต่อจาก Phase 3.5) มีสองแบบ: ทรัพย์สินที่ยังใช้งานทุกใบ ไม่ต้องเปิดสวิตช์ (สาขาและ `machineId` มาจากทรัพย์สิน) หรืองานทั่วไปที่ไม่ผูกทรัพย์สิน เช่น ไฟ ประปา เก้าอี้ ซึ่งเลือกแค่สาขา เครื่องจักรไม่ใช่ตัวเลือกแยก สวิตช์ "เข้าแผนซ่อมบำรุง" คุมแค่แผน PM migration `20261022170000_work_orders_general_repair` ลบ CHECK เป้าหมายบน `work_orders` เท่านั้น แผนและรอบยังต้องมีเป้าหมาย API `POST /api/work-orders` รับ `assetId` หรือ `branchId` ไม่รับ `machineId` แล้ว รายการและรายละเอียดแสดงชื่อทรัพย์สินพร้อมลิงก์เครื่องจักรถ้ามี หรือ "งานทั่วไป" ตัวกรอง `?machineId=` ยังใช้ได้ และเพิ่ม `?assetId=` หน้าเครื่องสร้างแผนได้เฉพาะเมื่อผูกกับทรัพย์สินที่เปิดสวิตช์  
Compliance เพิ่มเหตุผลไม่นับ `asset_inactive` และแสดงชื่อเป้าหมายจากทรัพย์สินก่อนเครื่องจักร ตัวช่วยแสดงผลกลางคือ `resolveTarget` ใน `pm-target.ts`

**ขนส่ง (อ่านอย่างเดียว)** `assignment-service.ts` ปฏิเสธการจ่ายงานและการเปิดงานอีกครั้ง เมื่อรถผูกทรัพย์สินที่มีใบงานซ่อมบำรุง `in_progress` หรือ `on_hold` พร้อมเลขใบงาน ไม่เขียน `currentStatus` ของรถ และไม่แตะ `repair-service.ts`  
สร้างใบซ่อมบำรุงของทรัพย์สินที่ผูกรถขณะที่รถมีใบแจ้งซ่อมขนส่งเปิดอยู่ ระบบขึ้นคำเตือนแต่ไม่บล็อก

**ข้อจำกัด**  
ใบงานซ่อมบำรุงยังไม่เป็นต้นทางค่าใช้จ่ายของการเงิน ไม่สร้าง Expense (Finance Phase 4 ล็อก) `labor_cost` / `parts_cost` เป็นตัวเลขปฏิบัติการเท่านั้น  
ทางย้ายใบแจ้งซ่อมขนส่งในอนาคต: เมื่อมีคำสั่ง ให้ใบแจ้งซ่อมใหม่ของรถที่ผูกทรัพย์สินเปิดเป็นใบงานซ่อมบำรุงแทน `transport_repair_logs` แล้วให้ขนส่งอ่านสถานะจากใบงาน (เหมือน guard ตอนนี้) ย้ายข้อมูลเก่าแบบ expand → migrate → verify → switch → contract และคง `transport_repair_logs` ให้อ่านย้อนหลังจนกว่าจะสั่งปิด

## Phase 4 — โครงการและกำลังคน

ยังไม่มีตารางโครงการกลาง จึงสร้างได้เฉพาะใน `modules/maintenance` และใช้ time entry ชุดเดียวกับใบงาน โดยผูก `project_task_id` แทนการสร้างใบงานทุกครั้งที่ลงเวลา  
กำลังคนใช้ `AttendanceDay` และวันหยุดที่มีอยู่ผ่าน `Personnel.userId` เท่านั้น  
dev มี personnel 54 แถวที่ผูก user ได้ 1 คน ดังนั้นหน้าตัวเลขต้องโชว์จำนวนคนที่ยังผูกไม่ได้ และป้ายว่าเป็นค่าประมาณ ห้ามสร้างตารางกะหรือระบบลา

จบเมื่อ planned load กับ actual labor คนละตัวเลข และไม่มี time tracking ชุดที่สอง

## Phase 5 — แดชบอร์ดและ rollout

ตัวเลขในข้อ 8.1 ของเอกสารข้อกำหนดต้องมาจาก service เดียวกัน และกดแล้วเปิดรายการต้นทางได้  
ไม่มี KPI จากข้อมูล mock  
pilot หนึ่งสาขาก่อนเปิดทุกสาขา

จบเมื่อหัวหน้าไล่จากตัวเลขกลับไปแถวในฐานได้ และ flow เปิดงาน → มอบหมาย → จับเวลา → ส่งมอบ → ปิดงาน ทำได้โดยไม่คีย์ซ้ำ

## ตรวจทุกเฟส

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

บวกเทสของเฟสนั้น และ smoke ของหน้ารายการใบงาน แผน และตาราง  
`lint` / `build` ที่ล้มจากไฟล์นอกเฟสให้บันทึกไว้ ไม่ใช้เป็นข้ออ้างว่าเฟสนี้ผ่าน

## สิ่งที่ยังไม่ทำหลัง Phase 0

- ยังไม่แก้ schema และยังไม่ migrate แถวเก่า
- ยังไม่ทำ wireframe แยกไฟล์
- ยังไม่นับข้อมูล production ต้องนับซ้ำบนสำเนาก่อน Phase 1 จะเขียนสถานะทับ
