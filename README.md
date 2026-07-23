# 🏭 Machine Maintenance System — Enterprise Edition

> **Tech Stack:** Next.js 15.5 (App Router) + PostgreSQL + Prisma ORM  
> **Last Updated:** 2026-04-27  
> **Version:** 2.0 (Optimized Design)  
> **หมายเหตุ:** เวอร์ชันแพ็กเกจล็อกตาม `package.json` / `package-lock.json` — สถานะปัจจุบันยกเป็น **Next 15 + Prisma 6** แล้ว (ดู Known Caveats ด้านล่าง)

---

## 🎯 Design Principles

| หลักการ | รายละเอียด |
|---------|-----------|
| **Multi-Tenant** | รองรับหลายบริษัท / หลายสาขา |
| **RBAC** | Role-Based Access Control ระดับ Branch |
| **Soft Delete** | ลบข้อมูลแบบ `deleted_at` ไม่ทำลายประวัติ |
| **Audit Trail** | บันทึกทุก action ผ่าน `audit_logs` |
| **Event Sourcing** | Stock/Inventory ผ่าน Transaction log |
| **Flexible Schema** | JSONB สำหรับ attributes ที่ยืดหยุ่น |
| **IoT Ready** | รองรับ sensor data และ API Integration |

---

## Modular architecture (โฟลเดอร์ + migration)

โครงสร้าง **modular monolith** (`modules/`, `shared/`) และแผนย้ายแบบไม่พัง route อยู่ที่:

- [docs/architecture/modular-folder-blueprint.md](docs/architecture/modular-folder-blueprint.md) — blueprint โฟลเดอร์ + โค้ด 3 เฟส
- [docs/architecture/db-blueprint.md](docs/architecture/db-blueprint.md) — ตาราง / normalization / DB 3 เฟส
- [docs/architecture/rollout-runbook.md](docs/architecture/rollout-runbook.md) — rollout & rollback
- [docs/architecture/contributing-modules.md](docs/architecture/contributing-modules.md) — วิธีเพิ่มโมดูลและ use-case

เมนูหลายโมดูล: tree ใน `shared/navigation/moduleRegistry.ts`, pipeline `buildDashboardNav`, command palette (Ctrl+K / ⌘K), ตั้งค่าต่อบริษัทผ่าน `companies.settings.nav` และ `GET|PATCH /api/settings/nav-preferences`

---

# 📐 Tech Stack

## Frontend
| เทคโนโลยี | เวอร์ชัน (ที่ติดตั้ง) | หน้าที่ |
|-----------|------------------------|--------|
| **Next.js** | 15.5.15 (App Router) | Framework หลัก |
| **React** | 19.2.x | UI |
| **TypeScript** | 5.7.3 | Type Safety |
| **TailwindCSS** | 3.4.x | Styling |
| **Radix UI** | ชุด `@radix-ui/react-*` | Primitives (สไตล์เดียวกับ shadcn/ui) |
| **TanStack Query** | 5.95.x | Server State Management |
| **Zustand** | 5.0.x | Client State |
| **React Hook Form** | 7.72.x | Form Management |
| **Zod** | 3.25.x | Schema Validation |
| **Recharts** | 2.15.4 | Dashboard Charts |
| **Lucide React** | 0.469.0 | Icons |
| **React Day Picker** | 9.14.x | ปฏิทิน |

## Backend
| เทคโนโลยี | เวอร์ชัน (ที่ติดตั้ง) | หน้าที่ |
|-----------|------------------------|--------|
| **Next.js API Routes** | 15.5.15 | REST API / Server Actions |
| **Prisma ORM** | 6.19.3 | Database Client & Migration |
| **PostgreSQL** | 15+ (แนะนำบน production) | Primary Database |
| **NextAuth.js** | 5.0.0-beta.31 (Auth.js) | Authentication |
| **@auth/prisma-adapter** | 2.11.x | Adapter สำหรับ Prisma |
| **bcryptjs** | 2.4.3 | Password Hashing |
| **node-cron** | 3.0.3 | Scheduled Jobs (Auto-generate schedule) |
| **Zod** | 3.25.x | API Input Validation |

## Infrastructure
| เทคโนโลยี | หน้าที่ |
|-----------|--------|
| **Vercel / Docker** | Deployment |
| **Supabase / Neon / self-hosted** | PostgreSQL Hosting |
| **AWS S3 / Cloudflare R2** | File/Image Storage |
| **Redis** | Cache & Queue (optional) |

## Known Caveats (หลังอัปเกรด)

- **ESLint migration:** เปลี่ยนไปใช้ `eslint` CLI + `eslint.config.mjs` (แทน `next lint`) ตามแนวทาง Next 15; ปัจจุบันยังมี warning เดิมในบางไฟล์
- **Auth middleware boundary:** แยก config เป็น `lib/auth.config.ts` เพื่อให้ middleware เป็น edge-safe และไม่ลาก Prisma/bcrypt เข้า middleware graph
- **DB schema drift note:** มีสคริปต์ [scripts/add-pm-columns.sql](scripts/add-pm-columns.sql) (`pm_general`, `pm_major`) ที่ไม่ได้อยู่ใน Prisma model โดยตรง — ควรพิจารณาจัดทำ migration/contract ให้ชัดในรอบถัดไป

---

# 🗄️ Database Schema (PostgreSQL Optimized)

## 📌 การออกแบบหลัก
- ใช้ `UUID` เป็น Primary Key ทุกตาราง (`gen_random_uuid()`)
- ทุกตารางมี `created_at`, `updated_at` (auto-update via trigger)
- ตารางหลักมี `deleted_at` (Soft Delete)
- ใช้ PostgreSQL `ENUM` แทน VARCHAR สำหรับ status/type fields
- ใช้ `JSONB` สำหรับข้อมูล flexible attributes
- กำหนด `INDEX` ทุก Foreign Key และ columns ที่ query บ่อย

---

## 🧩 Group 1: Organization (Multi-Tenant)

### 1. `companies`
| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | `gen_random_uuid()` |
| `code` | VARCHAR(20) UNIQUE | รหัสบริษัท |
| `name` | VARCHAR(255) NOT NULL | ชื่อบริษัท |
| `logo_url` | TEXT | URL โลโก้ |
| `settings` | JSONB | การตั้งค่าระดับบริษัท |
| `is_active` | BOOLEAN DEFAULT true | |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | auto-update |
| `deleted_at` | TIMESTAMPTZ | soft delete |

### 2. `branches`
| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `company_id` | UUID FK → companies | |
| `code` | VARCHAR(20) | INDEX |
| `name` | VARCHAR(255) NOT NULL | |
| `address` | TEXT | |
| `latitude` | DECIMAL(10,8) | GPS |
| `longitude` | DECIMAL(11,8) | GPS |
| `timezone` | VARCHAR(50) DEFAULT 'Asia/Bangkok' | |
| `is_active` | BOOLEAN DEFAULT true | |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | |
| `deleted_at` | TIMESTAMPTZ | |

**INDEX:** `(company_id)`, `(code)`

### 3. `departments`
| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `branch_id` | UUID FK → branches | |
| `code` | VARCHAR(20) | |
| `name` | VARCHAR(255) NOT NULL | |
| `parent_id` | UUID FK → departments | self-referencing (ลำดับชั้น) |
| `is_active` | BOOLEAN DEFAULT true | |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | |

**INDEX:** `(branch_id)`, `(parent_id)`

---

## 🧩 Group 2: Users & Access Control (RBAC)

### 4. `users`
| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `company_id` | UUID FK → companies | |
| `employee_code` | VARCHAR(50) UNIQUE | รหัสพนักงาน |
| `email` | VARCHAR(255) UNIQUE NOT NULL | |
| `password_hash` | TEXT | bcrypt |
| `first_name` | VARCHAR(100) NOT NULL | |
| `last_name` | VARCHAR(100) NOT NULL | |
| `phone` | VARCHAR(20) | |
| `avatar_url` | TEXT | |
| `is_active` | BOOLEAN DEFAULT true | |
| `last_login_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | |
| `deleted_at` | TIMESTAMPTZ | |

**INDEX:** `(company_id)`, `(email)`, `(employee_code)`

### 5. `roles`
| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `company_id` | UUID FK → companies | |
| `name` | VARCHAR(100) NOT NULL | Admin, Manager, Technician, Viewer |
| `permissions` | JSONB | `{"work_order": ["create","read","update"], ...}` |
| `is_system` | BOOLEAN DEFAULT false | ระบบกำหนด ลบไม่ได้ |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |

### 6. `user_branch_roles`
> **หนึ่ง User มีได้หลาย Role ในแต่ละ Branch**

| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | |
| `branch_id` | UUID FK → branches | |
| `role_id` | UUID FK → roles | |
| `assigned_by` | UUID FK → users | |
| `assigned_at` | TIMESTAMPTZ DEFAULT now() | |

**UNIQUE:** `(user_id, branch_id, role_id)`  
**INDEX:** `(user_id)`, `(branch_id)`

---

## 🧩 Group 3: Machine Master Data

### 7. `machine_categories`
| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `company_id` | UUID FK → companies | |
| `code` | VARCHAR(20) | |
| `name` | VARCHAR(255) NOT NULL | |
| `parent_id` | UUID FK → machine_categories | self-ref (hierarchy) |
| `icon` | VARCHAR(50) | icon name |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |

### 8. `machines`
| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `branch_id` | UUID FK → branches | |
| `department_id` | UUID FK → departments | NULLABLE |
| `category_id` | UUID FK → machine_categories | |
| `code` | VARCHAR(50) UNIQUE | รหัสเครื่อง |
| `name` | VARCHAR(255) NOT NULL | |
| `model` | VARCHAR(100) | รุ่น |
| `manufacturer` | VARCHAR(100) | ผู้ผลิต |
| `serial_number` | VARCHAR(100) | หมายเลขเครื่อง |
| `install_date` | DATE | |
| `warranty_expire_date` | DATE | วันหมดประกัน |
| `status` | machine_status ENUM | |
| `critical_level` | SMALLINT DEFAULT 1 | 1=Low, 2=Medium, 3=High, 4=Critical |
| `location_detail` | VARCHAR(255) | ตำแหน่งในโรงงาน |
| `attributes` | JSONB | ข้อมูลเพิ่มเติม flexible |
| `qr_code` | TEXT | QR/Barcode สำหรับ scan |
| `created_by` | UUID FK → users | |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | |
| `deleted_at` | TIMESTAMPTZ | |

**ENUM `machine_status`:** `active`, `inactive`, `under_maintenance`, `decommissioned`  
**INDEX:** `(branch_id)`, `(category_id)`, `(status)`, `(code)`

### 9. `machine_images`
| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `machine_id` | UUID FK → machines | |
| `file_url` | TEXT NOT NULL | S3/R2 URL |
| `file_name` | VARCHAR(255) | |
| `file_size` | INT | bytes |
| `is_primary` | BOOLEAN DEFAULT false | รูปหลัก |
| `uploaded_by` | UUID FK → users | |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |

### 10. `machine_documents`
| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `machine_id` | UUID FK → machines | |
| `doc_type` | VARCHAR(50) | Manual, Warranty, Spec |
| `title` | VARCHAR(255) | |
| `file_url` | TEXT | |
| `uploaded_by` | UUID FK → users | |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |

---

## 🧩 Group 4: Maintenance Planning

### 11. `maintenance_types`
| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `company_id` | UUID FK → companies | |
| `code` | VARCHAR(20) | PM, CM, BM, PdM |
| `name` | VARCHAR(100) NOT NULL | |
| `description` | TEXT | |
| `color` | VARCHAR(7) | #HEX สำหรับ Calendar |
| `requires_shutdown` | BOOLEAN DEFAULT false | ต้องหยุดเครื่อง |

### 12. `maintenance_plans`
| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `machine_id` | UUID FK → machines | |
| `type_id` | UUID FK → maintenance_types | |
| `name` | VARCHAR(255) NOT NULL | |
| `description` | TEXT | |
| `frequency_unit` | freq_unit ENUM | `day`, `week`, `month`, `year`, `runtime_hour` |
| `frequency_value` | SMALLINT NOT NULL | เช่น 1 = ทุก 1 เดือน |
| `estimated_duration_min` | INT | เวลาที่ใช้โดยประมาณ (นาที) |
| `start_date` | DATE NOT NULL | |
| `end_date` | DATE | NULLABLE = ไม่มีวันสิ้นสุด |
| `last_generated_date` | DATE | วันที่ generate schedule ล่าสุด |
| `lead_time_days` | SMALLINT DEFAULT 7 | แจ้งล่วงหน้ากี่วัน |
| `assigned_role` | UUID FK → roles | Role ที่รับผิดชอบ |
| `is_active` | BOOLEAN DEFAULT true | |
| `created_by` | UUID FK → users | |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | |

**ENUM `freq_unit`:** `day`, `week`, `month`, `quarter`, `year`, `runtime_hour`  
**INDEX:** `(machine_id)`, `(type_id)`, `(is_active)`

---

## 🧩 Group 5: Scheduling & Work Orders

### 13. `maintenance_schedules`
| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `plan_id` | UUID FK → maintenance_plans | |
| `machine_id` | UUID FK → machines | denormalized สำหรับ query เร็ว |
| `due_date` | DATE NOT NULL | |
| `planned_start` | TIMESTAMPTZ | |
| `planned_end` | TIMESTAMPTZ | |
| `status` | schedule_status ENUM | |
| `is_auto_generated` | BOOLEAN DEFAULT true | |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | |

**ENUM `schedule_status`:** `pending`, `in_progress`, `completed`, `overdue`, `cancelled`, `skipped`  
**INDEX:** `(plan_id)`, `(machine_id)`, `(due_date)`, `(status)`

### 14. `work_orders`
| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `wo_number` | VARCHAR(30) UNIQUE | WO-2024-00001 (auto-generate) |
| `schedule_id` | UUID FK → maintenance_schedules | NULLABLE (CM/BM ไม่มีแผน) |
| `machine_id` | UUID FK → machines | |
| `type_id` | UUID FK → maintenance_types | |
| `branch_id` | UUID FK → branches | denormalized |
| `priority` | wo_priority ENUM | |
| `status` | wo_status ENUM | |
| `title` | VARCHAR(255) NOT NULL | |
| `description` | TEXT | |
| `planned_start` | TIMESTAMPTZ | |
| `planned_end` | TIMESTAMPTZ | |
| `actual_start` | TIMESTAMPTZ | |
| `actual_end` | TIMESTAMPTZ | |
| `downtime_min` | INT DEFAULT 0 | เวลาหยุดเครื่อง |
| `labor_cost` | DECIMAL(12,2) DEFAULT 0 | ค่าแรง |
| `parts_cost` | DECIMAL(12,2) DEFAULT 0 | ค่าอะไหล่ (auto-calculated) |
| `total_cost` | DECIMAL(12,2) GENERATED | `labor_cost + parts_cost` |
| `assigned_to` | UUID FK → users | ช่างที่รับผิดชอบหลัก |
| `created_by` | UUID FK → users | |
| `approved_by` | UUID FK → users | |
| `approved_at` | TIMESTAMPTZ | |
| `closed_at` | TIMESTAMPTZ | |
| `root_cause` | TEXT | สาเหตุ |
| `corrective_action` | TEXT | วิธีแก้ไข |
| `remarks` | TEXT | |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | |

**ENUM `wo_priority`:** `low`, `medium`, `high`, `critical`  
**ENUM `wo_status`:** `draft`, `open`, `in_progress`, `on_hold`, `completed`, `cancelled`  
**INDEX:** `(machine_id)`, `(branch_id)`, `(status)`, `(assigned_to)`, `(planned_start)`, `(wo_number)`

### 15. `work_order_technicians`
> **Work Order มีช่างได้หลายคน**

| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `work_order_id` | UUID FK → work_orders | |
| `user_id` | UUID FK → users | |
| `role_in_task` | VARCHAR(50) | Lead, Assistant |
| `assigned_at` | TIMESTAMPTZ DEFAULT now() | |

---

## 🧩 Group 6: Checklist System

### 16. `checklist_templates`
> **แยก Template ออกจาก Plan — ใช้ซ้ำได้ข้ามแผน**

| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `company_id` | UUID FK → companies | |
| `category_id` | UUID FK → machine_categories | NULLABLE |
| `type_id` | UUID FK → maintenance_types | NULLABLE |
| `name` | VARCHAR(255) NOT NULL | ชื่อ Template |
| `version` | SMALLINT DEFAULT 1 | |
| `is_active` | BOOLEAN DEFAULT true | |
| `created_by` | UUID FK → users | |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |

### 17. `checklist_items`
| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `template_id` | UUID FK → checklist_templates | |
| `sequence` | SMALLINT NOT NULL | ลำดับ |
| `section` | VARCHAR(100) | หมวด เช่น "ระบบไฟฟ้า" |
| `item_name` | VARCHAR(255) NOT NULL | รายการตรวจสอบ |
| `item_type` | item_type ENUM | |
| `standard_value` | VARCHAR(100) | ค่ามาตรฐาน |
| `min_value` | DECIMAL(10,4) | สำหรับ numeric |
| `max_value` | DECIMAL(10,4) | สำหรับ numeric |
| `unit` | VARCHAR(30) | หน่วย |
| `is_required` | BOOLEAN DEFAULT true | |

**ENUM `item_type`:** `checkbox`, `numeric`, `text`, `select`, `photo`

### 18. `plan_checklist_templates`
> **Mapping แผน → Template (many-to-many)**

| Column | Type | หมายเหตุ |
|--------|------|---------|
| `plan_id` | UUID FK → maintenance_plans | |
| `template_id` | UUID FK → checklist_templates | |

**PK:** `(plan_id, template_id)`

### 19. `checklist_results`
| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `work_order_id` | UUID FK → work_orders | |
| `item_id` | UUID FK → checklist_items | |
| `actual_value` | TEXT | |
| `status` | check_status ENUM | |
| `remark` | TEXT | |
| `photo_url` | TEXT | รูปถ่ายประกอบ |
| `recorded_by` | UUID FK → users | |
| `recorded_at` | TIMESTAMPTZ DEFAULT now() | |

**ENUM `check_status`:** `pass`, `fail`, `na`, `warning`

---

## 🧩 Group 7: Spare Parts & Inventory

### 20. `suppliers`
| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `company_id` | UUID FK → companies | |
| `code` | VARCHAR(20) UNIQUE | |
| `name` | VARCHAR(255) NOT NULL | |
| `contact_name` | VARCHAR(100) | |
| `phone` | VARCHAR(20) | |
| `email` | VARCHAR(255) | |
| `address` | TEXT | |
| `lead_time_days` | SMALLINT | |
| `is_active` | BOOLEAN DEFAULT true | |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |

### 21. `spare_parts`
| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `company_id` | UUID FK → companies | |
| `supplier_id` | UUID FK → suppliers | NULLABLE |
| `code` | VARCHAR(50) UNIQUE | |
| `name` | VARCHAR(255) NOT NULL | |
| `description` | TEXT | |
| `unit` | VARCHAR(20) NOT NULL | ชิ้น, ลิตร, เมตร |
| `unit_cost` | DECIMAL(12,2) DEFAULT 0 | ต้นทุนต่อหน่วย |
| `min_stock` | INT DEFAULT 0 | จำนวนขั้นต่ำ |
| `lead_time_days` | SMALLINT DEFAULT 0 | |
| `attributes` | JSONB | spec อะไหล่ |
| `is_active` | BOOLEAN DEFAULT true | |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | |

### 22. `spare_part_inventory`
> **Stock แยกตาม Branch/คลัง**

| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `part_id` | UUID FK → spare_parts | |
| `branch_id` | UUID FK → branches | |
| `current_stock` | INT DEFAULT 0 | stock ปัจจุบัน |
| `reserved_stock` | INT DEFAULT 0 | จอง WO ยังไม่ปิด |
| `updated_at` | TIMESTAMPTZ | |

**UNIQUE:** `(part_id, branch_id)`

### 23. `spare_part_transactions`
> **Event log ทุกการเคลื่อนไหวของ stock**

| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `part_id` | UUID FK → spare_parts | |
| `branch_id` | UUID FK → branches | |
| `work_order_id` | UUID FK → work_orders | NULLABLE |
| `transaction_type` | txn_type ENUM | |
| `quantity` | INT NOT NULL | บวก = รับเข้า, ลบ = เบิกออก |
| `balance_after` | INT NOT NULL | stock หลัง transaction |
| `unit_cost` | DECIMAL(12,2) | |
| `reference_no` | VARCHAR(50) | เลขที่เอกสารอ้างอิง |
| `remark` | TEXT | |
| `created_by` | UUID FK → users | |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |

**ENUM `txn_type`:** `receive`, `issue_wo`, `return`, `adjust`, `transfer`  
**INDEX:** `(part_id, branch_id)`, `(work_order_id)`, `(created_at)`

### 24. `work_order_parts`
| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `work_order_id` | UUID FK → work_orders | |
| `part_id` | UUID FK → spare_parts | |
| `qty_planned` | INT DEFAULT 0 | วางแผนใช้ |
| `qty_used` | INT DEFAULT 0 | ใช้จริง |
| `unit_cost` | DECIMAL(12,2) | ณ เวลาใช้ |
| `total_cost` | DECIMAL(12,2) GENERATED | `qty_used * unit_cost` |

---

## 🧩 Group 8: Notifications & Audit

### 25. `notifications`
| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | ผู้รับ |
| `type` | notif_type ENUM | |
| `title` | VARCHAR(255) NOT NULL | |
| `message` | TEXT | |
| `link` | TEXT | URL หน้าที่เกี่ยวข้อง |
| `ref_id` | UUID | ID ของ WO/Schedule |
| `ref_type` | VARCHAR(50) | `work_order`, `schedule` |
| `is_read` | BOOLEAN DEFAULT false | |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |

**ENUM `notif_type`:** `overdue_schedule`, `upcoming_maintenance`, `wo_assigned`, `low_stock`, `wo_completed`  
**INDEX:** `(user_id, is_read)`, `(created_at)`

### 26. `audit_logs`
| Column | Type | หมายเหตุ |
|--------|------|---------|
| `id` | BIGSERIAL PK | ใช้ BIGSERIAL เพราะ volume สูง |
| `user_id` | UUID FK → users | NULLABLE (system action) |
| `table_name` | VARCHAR(100) NOT NULL | |
| `record_id` | UUID NOT NULL | |
| `action` | audit_action ENUM | |
| `old_values` | JSONB | ค่าเดิม |
| `new_values` | JSONB | ค่าใหม่ |
| `ip_address` | INET | |
| `user_agent` | TEXT | |
| `created_at` | TIMESTAMPTZ DEFAULT now() | |

**ENUM `audit_action`:** `create`, `update`, `delete`, `restore`  
**INDEX:** `(table_name, record_id)`, `(user_id)`, `(created_at)`  
⚠️ **Partition by range (created_at) เมื่อ data มาก**

---

# 🔗 Entity Relationship Diagram (Simplified)

```
companies
  └── branches
        └── departments
        └── user_branch_roles ── users ── roles
        └── spare_part_inventory

machines (branch_id, category_id, department_id)
  └── machine_images
  └── machine_documents
  └── maintenance_plans (type_id)
        └── plan_checklist_templates ── checklist_templates
              └── checklist_items
        └── maintenance_schedules
              └── work_orders
                    ├── work_order_technicians ── users
                    ├── work_order_parts ── spare_parts
                    │     └── spare_part_transactions
                    └── checklist_results ── checklist_items

notifications ── users
audit_logs
```

---

# 🧠 Business Logic

## 🔁 Auto-Generate Schedule (Cron Job)
```
ทุกวัน 00:00 UTC+7:
  FOR EACH active maintenance_plan:
    IF last_generated_date < today + lead_time_days:
      calculate next due_date ตาม frequency
      INSERT INTO maintenance_schedules
      UPDATE last_generated_date
      CREATE notification สำหรับ assigned_role
```

## 🚨 Overdue Detection
```sql
-- Query ที่ใช้ index เต็มประสิทธิภาพ
SELECT s.*, m.name AS machine_name, b.name AS branch_name
FROM maintenance_schedules s
JOIN machines m ON m.id = s.machine_id
JOIN branches b ON b.id = m.branch_id
WHERE s.due_date < CURRENT_DATE
  AND s.status = 'pending'
  AND s.deleted_at IS NULL;
```

## 📦 Stock Auto-Update (Database Trigger)
```sql
-- Trigger บน work_order_parts (qty_used update)
UPDATE spare_part_inventory
SET current_stock = current_stock - NEW.qty_used
WHERE part_id = NEW.part_id AND branch_id = :branch_id;

INSERT INTO spare_part_transactions (...) VALUES (...);
```

## 💰 Total Cost Auto-Calculate (Generated Column)
```sql
total_cost DECIMAL(12,2) GENERATED ALWAYS AS (labor_cost + parts_cost) STORED
```

---

# 🗂️ PostgreSQL Performance Optimizations

## Indexes Strategy
```sql
-- Machine lookup
CREATE INDEX idx_machines_branch ON machines(branch_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_machines_status ON machines(status) WHERE deleted_at IS NULL;

-- Schedule dashboard query
CREATE INDEX idx_schedule_due_status ON maintenance_schedules(due_date, status);
CREATE INDEX idx_schedule_machine ON maintenance_schedules(machine_id, status);

-- Work Order
CREATE INDEX idx_wo_status_branch ON work_orders(branch_id, status);
CREATE INDEX idx_wo_assigned ON work_orders(assigned_to, status);

-- Audit (Partial index)
CREATE INDEX idx_audit_recent ON audit_logs(created_at) WHERE created_at > NOW() - INTERVAL '90 days';

-- JSONB
CREATE INDEX idx_machines_attributes ON machines USING GIN(attributes);
```

## Partitioning (Long-term)
```sql
-- audit_logs partition by year
CREATE TABLE audit_logs_2025 PARTITION OF audit_logs
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- spare_part_transactions partition by month
```

---

# 🚀 Development Plan (Next.js + PostgreSQL)

## Phase 1: Project Setup & Foundation (สัปดาห์ 1-2)
- [ ] **P1.1** สร้าง Next.js 14 project (App Router + TypeScript)
- [ ] **P1.2** ติดตั้ง dependencies: Prisma, shadcn/ui, TailwindCSS, TanStack Query
- [ ] **P1.3** เขียน Prisma Schema ตาม Database Design ด้านบน
- [ ] **P1.4** สร้าง PostgreSQL Database + run migration
- [ ] **P1.5** ตั้งค่า NextAuth.js (Email/Password + JWT)
- [ ] **P1.6** สร้าง Middleware สำหรับ RBAC (protect routes)
- [ ] **P1.7** สร้าง Seed Data (Company, Branch, Admin User)

## Phase 2: Core Master Data (สัปดาห์ 2-3)
- [ ] **P2.1** Company & Branch Management (CRUD)
- [ ] **P2.2** Department Management
- [ ] **P2.3** User Management + Role Assignment
- [ ] **P2.4** Machine Category Management
- [ ] **P2.5** Machine Master Data (CRUD + Image Upload)
- [ ] **P2.6** Supplier & Spare Parts Management
- [ ] **P2.7** Spare Part Inventory per Branch

## Phase 3: Maintenance Planning (สัปดาห์ 3-4)
- [ ] **P3.1** Maintenance Type Setup
- [ ] **P3.2** Checklist Template Builder (drag & drop items)
- [ ] **P3.3** Maintenance Plan CRUD
- [ ] **P3.4** Schedule Auto-Generation (node-cron)
- [ ] **P3.5** Maintenance Calendar View (monthly/weekly)
- [ ] **P3.6** Overdue Alert System

## Phase 4: Work Order System (สัปดาห์ 4-5)
- [ ] **P4.1** Work Order Creation (จาก Schedule + Manual CM/BM)
- [ ] **P4.2** WO Assignment to Technician
- [ ] **P4.3** WO Status Workflow (Draft → Open → In Progress → Completed)
- [ ] **P4.4** Checklist Execution (บันทึกผล real-time)
- [ ] **P4.5** Spare Parts Usage Recording
- [ ] **P4.6** WO Cost Calculation
- [ ] **P4.7** WO Approval Workflow

## Phase 5: Dashboard & Reports (สัปดาห์ 5-6)
- [ ] **P5.1** Executive Dashboard (KPI Cards + Charts)
  - OEE / MTBF / MTTR
  - Cost by Month/Category
  - Overdue Count
- [ ] **P5.2** Machine Status Board (Real-time)
- [ ] **P5.3** Maintenance Schedule Report
- [ ] **P5.4** Work Order History Report
- [ ] **P5.5** Spare Parts Usage & Stock Report
- [ ] **P5.6** Export Excel/PDF (react-pdf, xlsx)

## Phase 6: Notifications & Polish (สัปดาห์ 6-7)
- [ ] **P6.1** In-App Notification System
- [ ] **P6.2** Email Notification (Nodemailer / Resend)
- [ ] **P6.3** Low Stock Alert
- [ ] **P6.4** Upcoming Maintenance Reminder
- [ ] **P6.5** Audit Log Viewer
- [ ] **P6.6** Mobile-responsive UI refinement
- [ ] **P6.7** QR Code Scanner (เปิด WO จาก QR บนเครื่อง)

## Phase 7: Integration & Advanced (Optional)
- [ ] **P7.1** REST API สำหรับ IoT Integration
- [ ] **P7.2** Machine Runtime Hour Tracking
- [ ] **P7.3** Predictive Maintenance Alert (rule-based)
- [ ] **P7.4** Multi-language (i18n: TH/EN)
- [ ] **P7.5** PWA Support (offline checklist)

---

# 📁 Next.js Project Structure

```
machine-maintenance/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Sidebar + RBAC guard
│   │   ├── page.tsx                # Dashboard
│   │   ├── machines/
│   │   │   ├── page.tsx            # Machine List
│   │   │   ├── [id]/page.tsx       # Machine Detail
│   │   │   └── new/page.tsx
│   │   ├── maintenance/
│   │   │   ├── plans/
│   │   │   ├── schedules/
│   │   │   └── calendar/
│   │   ├── work-orders/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── spare-parts/
│   │   ├── reports/
│   │   └── settings/
│   │       ├── users/
│   │       ├── branches/
│   │       └── roles/
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── machines/route.ts
│       ├── work-orders/route.ts
│       ├── schedules/route.ts
│       ├── spare-parts/route.ts
│       └── cron/generate-schedules/route.ts
├── components/
│   ├── ui/                         # shadcn/ui components
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   └── header.tsx
│   ├── machines/
│   ├── work-orders/
│   ├── checklist/
│   └── charts/
├── lib/
│   ├── prisma.ts                   # Prisma client singleton
│   ├── auth.ts                     # NextAuth config
│   ├── permissions.ts              # RBAC helpers
│   └── utils.ts
├── hooks/
│   ├── use-work-orders.ts
│   └── use-machines.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── types/
│   └── index.ts
├── .env.local
├── package.json
└── README.md
```

---

# ⚙️ Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/machine_maintenance"

# NextAuth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# File Storage (Cloudflare R2 / AWS S3)
STORAGE_ENDPOINT=""
STORAGE_ACCESS_KEY=""
STORAGE_SECRET_KEY=""
STORAGE_BUCKET=""

# Email (Resend)
RESEND_API_KEY=""
```

---

# 📊 KPI Definitions

| KPI | สูตร | หน่วย |
|-----|------|-------|
| **MTBF** | ระยะเวลาเฉลี่ยระหว่างความเสีย | ชั่วโมง |
| **MTTR** | Mean Time To Repair | ชั่วโมง |
| **PM Compliance** | WO Completed (PM) / WO Planned (PM) × 100 | % |
| **Overdue Rate** | Overdue Schedules / Total Schedules × 100 | % |
| **Cost per Machine** | Total WO Cost / Machine Count | บาท |
| **Stock Availability** | Parts in Stock / Parts Requested × 100 | % |