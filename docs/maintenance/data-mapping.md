# Maintenance data mapping (Phase 0)

วันที่นับ: 2026-10-21  
ฐาน: dev ในเครื่องผ่าน `DATABASE_URL` ของ `.env` ไม่ใช่ production  
วิธี: `SELECT` อย่างเดียว ไม่มี `INSERT` / `UPDATE` / `DELETE`  
คู่กับ [audit.md](./audit.md) และ [implementation-plan.md](./implementation-plan.md)

ตัวเลขนี้ใช้ตรวจว่า mapping ด้านล่างชนข้อมูลอะไรใน dev ก่อนย้ายขึ้นสำเนา production ต้องนับชุดเดียวกันซ้ำ แล้วเทียบกับตารางนี้ ห้ามใช้ตัวเลข dev เป็นเกณฑ์ go-live

## 1. Inventory

บริษัท 1 แห่ง สาขา 6 แห่ง

### ใบงาน `work_orders` (3 แถว)

| สถานะ | จำนวน |
|-------|------:|
| `open` | 3 |
| `draft`, `in_progress`, `on_hold`, `completed`, `cancelled` | 0 |

| สภาพ | จำนวน |
|------|------:|
| `open` และมี `assigned_to` | 3 |
| `open` และไม่มี `assigned_to` | 0 |
| มี `schedule_id` | 0 |
| ไม่มี `schedule_id` | 3 |
| `completed` แต่ `closed_at` ว่าง | 0 |
| มี `actual_start` / `actual_end` / `approved_by` | 0 |
| `labor_cost` หรือ `parts_cost` หรือ `downtime_min` ไม่ใช่ 0 | 0 |
| มี `images_before` และ `images_after` | 1 |
| มี `root_cause` ทั้งที่สถานะยัง `open` | 1 |
| สาขาใบงานไม่ตรงสาขาเครื่อง | 0 |
| ใบงานชี้เครื่องที่ `deleted_at` ไม่ว่าง | 3 |

ใบงานทั้ง 3 ใบอยู่ในเครื่องที่ถูก soft-delete 1 เครื่อง สถานะเครื่องนั้นยังเป็น `active` การสร้างใบงานชุดใหม่ปฏิเสธเครื่องที่ `deleted_at` ไม่ว่างแล้ว แถวเก่านี้จึงเป็นข้อมูลค้าง

### ตารางลูกของใบงาน

| ตาราง | จำนวน |
|-------|------:|
| `work_order_technicians` | 0 |
| `work_order_parts` | 0 |
| `checklist_results` | 0 |
| `checklist_templates` / `checklist_items` / `plan_checklist_templates` | 0 |
| `spare_part_transactions` ที่ผูกใบงาน | 0 |

### แผนและตาราง

| รายการ | จำนวน |
|--------|------:|
| `maintenance_plans` active, `frequency_unit = month` | 7 |
| แผน inactive หรือรอบอื่นรวม `runtime_hour` | 0 |
| แผนที่ไม่มีแถวใน `maintenance_schedules` | 6 |
| `maintenance_schedules` สถานะ `pending` | 1 |
| กลุ่ม `(plan_id, due_date)` ที่ซ้ำ | 0 |
| ตารางที่ `machine_id` ไม่ตรงแผน | 0 |
| `maintenance_types` | 20 |
| `machine_categories` | 20 |

โค้ดสร้างแผนปัจจุบันสร้าง schedule แรกทุกครั้ง แผน 6 ใบที่ไม่มีตารางจึงเกิดก่อนกติกานี้ หรือถูกลบตารางไปแล้ว อย่า backfill ย้อนหลังโดยไม่สั่งแยก

### เครื่อง คน และร่องรอย

| รายการ | จำนวน |
|--------|------:|
| `machines` | 8 |
| `machines.deleted_at` ไม่ว่าง (สถานะยัง `active`) | 1 |
| `personnel` | 54 |
| `personnel.user_id` ไม่ว่าง | 1 |
| `users` | 5 |
| `attendance_days` | 7899 |
| `attendance_holidays` | 2 |
| `audit_logs` ของ `maintenance_plans` action `delete` | 3 |
| `audit_logs` ของ `work_orders` หรือ `maintenance_schedules` | 0 |
| แจ้งเตือน `overdue_schedule` | 12 |
| แจ้งเตือน `wo_assigned` | 1 |

แผนทั้ง 7 ใบยัง `is_active = true` ดังนั้นแถว audit `delete` ไม่ใช่สถานะปัจจุบัน มันคือประวัติการปิดแผนที่ถูกเปิดกลับ หรือคนละความหมายกับ flag ปัจจุบัน ห้ามใช้ audit action เป็นตัวตั้ง `is_active`

แจ้งเตือน `overdue_schedule` 12 แถว ขณะที่มีตาราง `pending` แค่ 1 แถว การแจ้งเตือนไม่ใช่ตัวนับงานเกินกำหนด

## 2. สถานะใบงาน

ค่าในฐานข้อมูลเป็นตัวพิมพ์เล็ก เฟสถัดไปต้องใช้แบบนั้น ไม่ใช้ `OPEN` ตัวใหญ่

เพิ่มค่า enum แบบ additive แล้วค่อยสลับ ยังไม่ลบ `completed` ในรอบแรก

| ของเดิม | เป้าหมายเมื่อสลับ | เงื่อนไข | แถวใน dev |
|---------|-------------------|----------|----------:|
| `draft` | `open` | ไม่มีผู้รับงาน ไม่มีแถวใน dev เลย | 0 |
| `open` และ `assigned_to` ว่าง | `open` | เปิดแล้วแต่ยังไม่มอบหมาย | 0 |
| `open` และ `assigned_to` ไม่ว่าง | `assigned` | มอบหมายแล้ว ยังไม่เริ่มจับเวลา | 3 |
| `in_progress` | `in_progress` | ชื่อเดิม | 0 |
| `on_hold` | `on_hold` | เหตุผลการรอ = `other`, note = `legacy: no wait reason` | 0 |
| `completed` และ `closed_at` ไม่ว่าง | `closed` | ใช้ `closed_at` เดิม | 0 |
| `completed` และ `closed_at` ว่าง | `closed` | ตั้ง `closed_at = updated_at` และติด flag `legacy_closed_without_timestamp` | 0 |
| `cancelled` | `cancelled` | ไม่สร้างเหตุผลปลอม ถ้า `remarks` ว่างให้ flag `legacy_cancel_without_reason` | 0 |

ยังไม่ map เข้า `ready_for_handover` หรือ `handed_over` เพราะของเดิมไม่มีสัญญาณส่งมอบ ใบงานที่มี `root_cause` แต่สถานะยัง `open` (1 แถว) ไม่ถือว่าปิดงาน

สถานะใหม่ที่ยังไม่มีแถว: `assigned`, `ready_for_handover`, `handed_over`, `closed`  
เก็บ `completed` ไว้ให้อ่านได้จนกว่าเฟส contract จะถอดออกจากฟอร์มและจากข้อมูล

`assigned` ในที่นี้คือสถานะใบงาน ไม่ใช่แถวใน `work_order_technicians` ตารางนั้นยังว่าง ผู้รับงานหลักอยู่ที่ `work_orders.assigned_to`

## 3. ประเภทงาน

ของเดิมไม่มีคอลัมน์ชนิดงาน ใช้ `type_id` → `maintenance_types` ซึ่งเป็นประเภทช่าง (20 แถว) ไม่ใช่ corrective/preventive/project

| สัญญาณ | `work_kind` ที่เสนอ | แถวใน dev |
|--------|---------------------|----------:|
| `schedule_id` ไม่ว่าง | `preventive` | 0 |
| `schedule_id` ว่าง | `corrective` | 3 |
| ไม่มีแหล่งข้อมูล | `project` | ไม่สร้างแถว |

ห้ามเดาโครงการจากชื่อใบงาน งานโครงการเริ่มที่ศูนย์เมื่อถึง Phase 4

`maintenance_types` ใช้ต่อเป็นประเภทงานซ่อม (เช่น ไฟฟ้า เครื่องกล) ไม่ใช่ตัวแทน `work_kind`

## 4. ฟิลด์ที่ map ได้

| เป้าหมาย | ของเดิม | หมายเหตุ |
|----------|---------|----------|
| เลขใบงาน | `wo_number` | unique ต่อ `(branch_id, wo_number)` |
| เครื่อง | `machine_id` | บังคับใน schema วันนี้ งานที่ไม่ผูกเครื่องยังไม่รองรับ |
| สาขา | `branch_id` | dev ไม่มีแถวที่สาขาใบงานไม่ตรงเครื่อง |
| ผู้รับหลัก | `assigned_to` → `users` | ไม่ย้ายไป `personnel` |
| ผู้สร้าง | `created_by` → `users` | ไม่มีฟิลด์ผู้แจ้งแยก ถ้าต้องมีผู้แจ้งให้ใช้ `created_by` จนกว่าจะมีคอลัมน์ใหม่ |
| ความเร่งด่วน | `priority` `low/medium/high/critical` | ใช้ต่อ |
| กำหนด | `planned_start`, `planned_end` | ไม่มี `due_at` แยก ใช้ `planned_end` เป็นกำหนดส่งจนกว่าจะเพิ่มคอลัมน์ |
| เวลาหัวใบงาน | `actual_start`, `actual_end`, `downtime_min` | ไม่ใช่ labor รายคน ดูข้อ 5 |
| แผน PM | `maintenance_plans` | ใช้ต่อ |
| occurrence | `maintenance_schedules` | อย่าสร้างตาราง occurrence ซ้ำ |
| ผลตรวจ | `checklist_results` | schema พร้อม ข้อมูล dev ว่าง |
| อะไหล่บนใบงาน | `work_order_parts` + `spare_part_transactions` | ข้อมูล dev ว่าง ไม่สร้าง ledger ใหม่ |
| รูป | `images_before`, `images_after` jsonb | อยู่ต่อ ยังไม่ย้ายเข้า `stored_files` ในเฟสแรก |

## 5. สิ่งที่ map ไม่ได้ ห้ามเดา

| เป้าหมาย | เหตุผล |
|----------|--------|
| ชั่วโมงแรงงานรายคน | ไม่มี time entry `actual_start` ทั้ง 3 ใบว่าง ห้ามเอา `downtime_min` หรือ `labor_cost` ไปเป็นชั่วโมงคน |
| เวลารอแยกเหตุผล | ไม่มีคอลัมน์ และไม่มีแถว `on_hold` |
| ประวัติสถานะใบงาน | ไม่มีแถว audit ของ `work_orders` ประวัติเริ่มนับจากวันที่เปิดใช้ตารางใหม่ ย้อนหลังไม่ได้ |
| รอบส่งกลับแก้ไข | ไม่มี |
| ผู้ตรวจรับ / `approved_by` | คอลัมน์มี แต่ไม่มีแถวและไม่มีโค้ดเขียน |
| checklist ที่ทำแล้ว | 0 แถว ทั้ง template และ result |
| PM ตามชั่วโมงเครื่อง | ไม่มีแผน `runtime_hour` และไม่มีตาราง meter ห้ามเปิด trigger นี้ |
| งานโครงการและ task | ไม่มีตาราง |
| กำลังคนพร้อมทำงานรายคน | `personnel` 54 แถว ผูก user ได้ 1 คน attendance มีข้อมูล แต่ผูกกับช่างในใบงานไม่ได้เกือบทั้งหมด |
| ผู้แจ้งที่เป็นพนักงาน HR | ไม่มี `requester` แยกจาก `created_by` |
| ค่าใช้จ่ายการเงิน | `labor_cost` / `parts_cost` เป็น 0 และไม่ใช่ Finance Expense |

## 6. สถานะตาราง PM

ใช้ค่าเดิม ไม่เปลี่ยนชื่อในเฟสแรก

| ของเดิม | ความหมายที่คงไว้ |
|---------|------------------|
| `pending` | ยังไม่ทำ |
| `overdue` | cron ตั้งเมื่อเลยกำหนด ยังไม่ทำ |
| `in_progress` | มีการลงมือ วันนี้ยังไม่มีโค้ดตั้งค่านี้ตอนสร้างใบงาน |
| `completed` | ทำรอบนี้แล้ว วันนี้ยังไม่ถูกตั้งเมื่อใบงานจบ |
| `cancelled` / `skipped` | ยกเลิกหรือข้ามรอบ ต้องมีเหตุผลเมื่อเริ่มบังคับในเฟส PM |

การสร้างใบงานจากตารางในเฟสหลังต้องเขียน `work_orders.schedule_id` และกันการสร้างซ้ำต่อหนึ่ง schedule ที่ยังไม่ยกเลิก ไม่ใช่แค่ unique ของ `(plan_id, due_date)`

## 7. Expand → migrate → verify → switch → contract

ยังไม่ทำใน Phase 0 ลำดับเมื่อได้รับคำสั่งเฟสถัดไป

1. **Expand** เพิ่มอย่างเดียว: ค่า enum สถานะใหม่, คอลัมน์ `work_kind` ที่ว่างได้, ตาราง `work_order_status_history` แอปเก่ายังอ่าน `completed` และ `open` ได้
2. **Migrate** สคริปต์แยกที่รันกับสำเนาฐาน ใช้กฎในข้อ 2 และ 3 เขียนจำนวนก่อน/หลัง ไม่ update แถวถ้าเข้าเงื่อนไข "ห้ามเดา"
3. **Verify** เทียบจำนวนสถานะ, จำนวนใบงาน, จำนวนที่ `schedule_id` ไม่ว่าง, ใบงานบนเครื่องที่ลบแล้วต้องยังอยู่ครบ 3 ใบใน dev และสาขาต้องไม่เปลี่ยน
4. **Switch** ให้ service เขียนสถานะใหม่และประวัติใน transaction เดียวกัน ฟอร์มเลิกส่ง status อิสระ
5. **Contract** ถอด `completed` ออกจาก UI และจาก enum ได้ก็ต่อเมื่อไม่มีแถวค้างและมี rollback ที่ทดสอบแล้ว

Rollback ก่อน switch: drop ตารางใหม่และคอลัมน์ใหม่ได้ เพราะยังไม่มีแอปอ่านมันเป็นแหล่งหลัก  
Rollback หลัง switch: ต้องมีสคริปต์ย้อนสถานะจาก `work_order_status_history` ไม่ใช่ restore ทั้งก้อนโดยไม่มีจุดตรวจ  
ห้าม `DROP` ตาราง `work_orders`, `maintenance_plans`, `maintenance_schedules`  
ก่อน `prisma migrate deploy` บน production ให้ backup ตาม [docs/ops/BACKUP.md](../ops/BACKUP.md)

เกณฑ์หยุด: จำนวนใบงานก่อน/หลังไม่เท่ากัน, ใบงานบนเครื่องที่ลบแล้วหาย, หรือมี `(plan_id, due_date)` ซ้ำทั้งที่ก่อน migrate เป็น 0

## 8. ข้อมูลที่ต้องตัดสินใจตอน dry run บนสำเนาจริง

dev ตอบไม่ได้ เพราะไม่มีแถวเหล่านี้ ถ้าสำเนา production มี ต้องหยุดแล้วบันทึกจำนวนก่อนเขียนทับ

- ใบงาน `completed` ที่ `closed_at` ว่าง
- ใบงาน `on_hold`
- ใบงาน `cancelled` ที่ไม่มีข้อความเหตุผล
- ใบงานที่ทั้งมีและไม่มี `schedule_id` ในชุดที่ผู้ใช้บอกว่าเป็นงานโครงการ
- schedule ซ้ำ `(plan_id, due_date)`
- แผน `runtime_hour`
