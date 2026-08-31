# ERP People / Personnel Architecture

**สถานะ:** Architecture lock — Phase 0–1 ลงแล้ว · **Phase 2 Shared Department Master ลงแล้ว** (`Personnel.departmentId?`) · **Phase 3-Org ปลดล็อกแล้ว** (`positions` + `Personnel.positionId?`)  
**ห้ามสร้าง PeopleDepartment** · ห้ามทำ supervisor graph บน Personnel / org history / dual-hat · ห้ามเปลี่ยน Expense/Driver/Asset FK จนกว่ามีคำสั่งเฟสนั้น  
กฎเอเจนต์: [`.cursor/rules/erp-people-personnel.mdc`](../../.cursor/rules/erp-people-personnel.mdc)  
Shared Master: [`erp-shared-master.md`](./erp-shared-master.md)  
Asset custodian (อนาคต): [`erp-asset-management.md`](./erp-asset-management.md)  
โมดูลเจ้าของทะเบียน: [`modules/hr`](../../modules/hr)

> One Personnel Master → Many Module Consumers  
> User และ Driver **ไม่ใช่** สมุดคน และไม่ถูกแทนที่

```text
HR (owner of the register)
      │
      ▼
 Shared Personnel Master     ← ตาราง personnel มีแล้ว
      │
      ├── IAM        → User          (login — optional Personnel.userId)
      ├── Transport  → Driver        (บทขนส่ง — optional Driver.personnelId ภายหลัง)
      ├── Finance    → Expense.employeeId ยังชี้ User
      ├── Maintenance→ WO assignee = User
      ├── Production → Worker = Personnel เมื่อมีโมดูล (ห้ามตารางซ้ำ)
      └── Asset      → Custodian = personnelId ในอนาคต (ห้ามสร้างตอนนี้)
```

---

## ADR

```text
ADR: People / Personnel Architecture

Decision:
  Option B — Shared Personnel Master เจ้าของทะเบียนคือ HR
  ใช้ตาราง personnel ที่มีอยู่ — ห้ามสร้าง Employee / Worker / Technician / Custodian
  User = login / สิทธิ์ / ผู้กดปุ่มในระบบ
  Driver = operational master ของ Transport (ไม่บังคับมี Personnel)
  Department = Shared Organization Master ต่อสาขา (Settings owns)
  คนกับเครื่อง reuse ตาราง departments ชุดเดียวกัน — ห้าม PeopleDepartment
  Position = Org node ต่อสาขา (HR owns) — ลำดับชั้นองค์กรอยู่บน Position.parentId
  Personnel.jobGroup ยังอยู่ — Position ไม่แทนที่และไม่ migrate

Status:
  Accepted (2026-08-31) — Phase 0 ล็อกแล้ว
  Phase 1 landed (2026-08-31) — roster CRUD + isActive + optional userId
  Phase 2 architecture accepted (2026-08-31) — Shared Department Master
  Phase 2 build landed (2026-08-31) — optional Personnel.departmentId + validate + delete/move guard
  Phase 3-Org unlocked (2026-08-31) — positions master + Personnel.positionId? + org chart
  Expense.employeeId ยังเป็น User; Driver ไม่เปลี่ยน

Owner:
  ทะเบียน Personnel = HR (modules/hr)
  User              = IAM
  Driver            = Transport
  Department        = Settings (Shared Org — Machine และ Personnel ใช้ชุดเดียวกัน)
  Expense           = Finance
  Role / Permission = IAM — ไม่เท่ากับแผนก

Scope:
  ตัดสินใจวางตัวและความเป็นเจ้าของ
  Phase 0 ไม่รวมตารางใหม่, migrate FK, Position, supervisor, employment enum

Why:
  ระบบมี Personnel + Attendance ทำงานแล้ว
  โมดูลนอก HR ไม่ได้ query personnel — ผู้กระทำเกือบทั้งหมดเป็น User
  Driver แยกอยู่และรถภายนอกต้องสร้างได้โดยไม่มีแถวการจ้าง
  Shared Master สอนมาสเตอร์ชุดเดียว โมดูลอ้าง — ไม่สอนให้รื้อ User หรือ Driver

Alternatives rejected:
  A  HR-owned แบบปิด    — บล็อกโมดูลอื่นอ้างคนคนเดียว
  C  User เป็นสมุดคน    — บัญชีล็อกอินไม่ใช่การจ้าง; admin ไม่ต้องมี Personnel
  D  Employee ต่อโมดูล  — ซ้ำแบบที่ห้ามกับ FinanceAsset / TransportCustomer

Implementation:
  Phase 0 = เอกสารนี้ + Cursor rule + ลิงก์จาก Shared Master / Vision
  Phase 1 = อัปเดต/ลบ/isActive/list ตามสาขา/โยง userId — ไม่สร้างตารางคนใหม่
  Phase 2 architecture = เอกสารนี้ (Shared Department Master)
  Phase 2 build = Personnel.departmentId? + validate สาขา + delete/move guard + HR picker (landed)
  Phase 3+ = Driver.personnelId / Expense remap — รอคำสั่งแยก

Deferred:
  supervisor graph บน Personnel, org / occupancy history, dual-hat (รักษาการ),
  payroll, leave, recruitment,
  Driver.personnelId, Expense.employeeId → Personnel, Asset custodian FK
```

---

## สิ่งที่มีอยู่แล้ว (FACT)

ตาราง `personnel` / `personnel_branches` / `attendance_entries` มีใน [`prisma/schema.prisma`](../../prisma/schema.prisma)

| Entity | ตาราง | Owner | หมายเหตุ |
|---|---|---|---|
| Personnel | `personnel` | HR | `rosterNo` ไม่ซ้ำต่อบริษัท; `userId?` 1:1 โยงบัญชีในบริษัทเดียวกันได้ (Phase 1) |
| PersonnelBranch | `personnel_branches` | HR | คนหนึ่งอยู่ได้หลายสาขา; `isPrimary` |
| Attendance | `attendance_entries` | HR | ผู้บริโภคเดียวของ Personnel วันนี้ |
| User | `users` | IAM | `employeeCode` คนละช่องกับ `rosterNo` |
| Driver | `drivers` | Transport | ไม่มี `personnelId` / `userId` |
| Department | `departments` | Settings | Shared Org ต่อสาขา; วันนี้ผู้บริโภค = Machine; Personnel.departmentId ยังไม่มี |
| Position | `positions` | HR | Org node ต่อสาขา (Phase 3-Org); `parentId` = สายบังคับบัญชา; `Personnel.jobGroup` ยังอยู่คู่กัน |
| Expense.employeeId | `expenses.employee_id` | Finance | FK → **User** ไม่ใช่ Personnel |

คำว่า “คน” ใน repo **ไม่ใช่สมุดเดียวกัน**:

| ที่พบ | ความหมายจริง |
|---|---|
| Nav department `people` | กลุ่ม UI ของ HR (บุคลากร + ลงเวลา) |
| `Expense.employeeId` | ผู้รับบิล = User |
| Role ชื่อ Technician / Manager | สิทธิ์ ไม่ใช่แถวคน |
| `WorkOrder.assignedTo` | User |
| Asset `createdBy` | User — custodian ยังไม่มี |

**Repository behavior มาก่อนชื่อใน UI** — อย่าสร้างตาราง Personnel ชุดที่สองเพียงเพราะแผนเรียกว่า People Foundation

---

## ความหมายที่ล็อก

```text
Personnel  = ตัวตนการจ้าง / รายชื่อในบริษัท (roster)
User       = บัญชีล็อกอิน + RBAC + ผู้กระทำในระบบ
Driver     = บทปฏิบัติการขนส่ง (ใบขับขี่, มอบหมายงาน)
Role       = สิทธิ์ — ไม่ใช่คน
Worker     = Personnel เมื่อมี Production — ห้าม ProductionWorker
Technician = User วันนี้ (ผู้ถูกมอบ WO)
Approver   = User (การกดอนุมัติ)
Custodian  = Personnel ในอนาคต — ห้าม userId
```

```text
Personnel  ≠  User
User       ≠  Driver
Driver     ≠  Personnel
Department ≠  Permission
User.employeeCode  ≠  Personnel.rosterNo
```

คนหนึ่งในอนาคตสวมได้หลายบท: Personnel → User? → Driver? → Custodian?  
ห้ามรวมเป็น Entity เดียวเพื่อลดจำนวนตาราง

---

## ชั้นข้อมูลที่ล็อก

```text
Personnel ──── Shared People Master     (HR owns register)
User ───────── Login / audit actor      (IAM)
Driver ─────── Transport operational    (ไม่บังคับมี Personnel)
Department ─── Shared Org Master        (Settings; ต่อสาขา; Machine + คนใช้ชุดเดียวกัน)
Position ───── Org node ต่อสาขา          (HR; parentId = สายบังคับบัญชา)
```

Personnel **ไม่ใช่ parent** ของ User หรือ Driver  
ห้ามบังคับให้ทุก User / ทุก Driver มีแถว Personnel

---

## Organization

```text
Company  →  Branch  →  Position (parentId ซ้อนชั้นได้)  →  Personnel
                    →  Department  →  Personnel            (แผนกบ้าน คงเดิม)
```

แผนกกับตำแหน่งเป็นสองมิติที่ตั้งฉากกัน ไม่ซ้อนเป็นชั้นเดียวกัน — `Position.departmentId?` เป็นแค่ป้าย/ตัวกรอง

Reuse:

- Company / Branch — ใช้ของที่มี
- Department — ตาราง `departments` เดิมเท่านั้น (Shared Org). Product ยืนยันคนกับเครื่องใช้แถวชุดเดียวกัน
- `Personnel.departmentId?` = หนึ่งแผนกต่อคน **หลัง** `APPROVE PERSONNEL PHASE 2 BUILD` — ห้าม `PeopleDepartment`
- Position — ตาราง `positions` ของ HR (Phase 3-Org); คง `jobGroup` ไว้คู่กัน

คนหนึ่งอยู่ได้หลาย**สาขา** (`PersonnelBranch`)  
คนหนึ่งอยู่หลายแผนก — ยังไม่รองรับ ห้ามสร้าง join  
แผนกบ้านอยู่สาขาเดียว (สาขาของแถว Department) — ลงเวลาสาขาอื่นไม่ต้องมีแผนกที่นั่น  
ย้ายสาขาแล้วแผนกไม่ valid → เคลียร์ `departmentId`  
ลบแผนก: นับทั้ง Machine และ Personnel (รวมแถว soft-delete)

หัวหน้า — อ่านจาก `Position.parentId` (ตำแหน่งแม่) ไม่ใช่ฟิลด์บนคน  
ห้ามเพิ่ม `supervisorPersonnelId` ห้ามทำกราฟหัวหน้าบน Personnel ห้ามอนุมานหัวหน้าแผนกอัตโนมัติ

CostCenter เป็นมิติการเงิน — ไม่ใช่แผนกคน  
Nav `launcher.departmentId: "people"` ≠ ตาราง `departments`

`Department.parentId` มีใน schema แต่แอปยังไม่ใช้ — คงคอลัมน์; รอบ build แรกไม่บังคับ UI ต้นไม้; parent ต้องสาขาเดียวกันเมื่อเปิด

---

## Shared Department Master (Phase 2 architecture)

```text
Company → Branch → Department → Personnel?   (home org, 0..1 — landed)
                      └── → Machine?        (มีแล้ว)
```

กฎ validate (ลงแล้ว):

- แผนก: `branch.companyId` = บริษัทในเซสชัน
- เครื่อง: `department.branchId === machine.branchId`
- คน: `department.branchId` อยู่ในสาขาที่คนถูก assign
- ห้ามย้าย `department.branchId` ถ้ายังมี Machine หรือ Personnel ชี้ (หรือเคลียร์ให้ครบ)
- อย่า CASCADE ลบคน/เครื่องเมื่อลบแผนก
- อย่ายกระดับแผนกเป็นของบริษัท

Machine ปรับ architecture ได้: เพิ่มตรวจสาขาตอน build — ไม่รื้อ `Machine.departmentId`

---

## Position Master (Phase 3-Org)

ปลดล็อกโดยคำสั่งมนุษย์ 2026-08-31 เพื่อทำผังองค์กรที่ `/hr/org` ตามผังกระดาษ

```text
Branch → Position (parentId ซ้อนชั้น) → Personnel (positionId?)
                 └── departmentId? = ป้าย/ตัวกรอง ไม่ใช่ชั้น
```

ทำไมลำดับชั้นอยู่บน Position ไม่ใช่บน Personnel: ผังต้องแสดง**ตำแหน่งว่าง**และ **JD** ซึ่งผูกกับตำแหน่ง ไม่ผูกกับคน ถ้าใช้ `supervisorPersonnelId` ตำแหน่งว่างจะแสดงไม่ได้

| ช่อง | ความหมาย |
|---|---|
| `branchId` | บังคับ — `positions` เป็น branch-scoped เหมือน `departments` |
| `parentId?` | สายบังคับบัญชา; `parent.branchId` ต้องเท่ากับ `branchId`; ห้ามวงกลม; ลึกไม่เกิน 10 |
| `departmentId?` | ป้าย/ตัวกรองเท่านั้น; `department.branchId` ต้องเท่ากับ `branchId` |
| `headcount` | อัตราที่วางไว้; ว่าง = `headcount - จำนวนคนที่นั่ง` |
| `responsibilities?` | JD บรรทัดละ 1 ข้อ แสดงเป็นลิสต์เลข |
| `isActive` | ปิดใช้งานแทนการลบเมื่อมีลูกหรือมีคนนั่ง |

กฎที่ล็อก:

- `Personnel.positionId?` — คนหนึ่งหนึ่งตำแหน่ง; `position.branchId` ต้องอยู่ในสาขาที่คนถูก assign
- ย้ายสาขาแล้วตำแหน่งไม่ valid → เคลียร์ `positionId` ไม่เก็บประวัติ (กฎเดียวกับ `departmentId`)
- `Personnel.jobGroup` **ไม่ถูกแทนที่ ไม่ถูก migrate ไม่ถูกลบ**
- `Department.parentId` ยังไม่ใช้ — ลำดับชั้นมีชุดเดียว
- ปิดใช้งานตำแหน่งที่มีลูก → ลูกเลื่อนขึ้นเป็น root ในมุมมองผัง ไม่ทิ้งกิ่งกำพร้า
- มุมมองแผนกเดิม (`getPersonnelOrgView`) คงไว้ทั้งหมด — `/hr/org?view=dept`

---

## รหัสพนักงาน

**รหัสการจ้างที่เป็นทางการ = `Personnel.rosterNo`** — ไม่ซ้ำต่อบริษัท กรอกมือได้ (Excel ลงเวลาพึ่งพาช่องนี้)

ฟอร์มเพิ่มรายชื่อ**แนะนำ**เลขถัดไปทั้งบริษัท (`001`, `002`, …) แต่ยังแก้ได้ เพื่อให้ตรงเครื่องลงเวลา/ไฟล์  
ไม่รันเลขต่อสาขา และไม่คัดลอกจาก `User.employeeCode`  
แถวที่ soft-delete ยังจองรหัสอยู่ — จ้างกลับให้พิมพ์รหัสเดิม ไม่ใช่รับเลขใหม่จากปุ่มแนะนำ

ห้ามผูกกับ `User.id` หรือคัดลอกอัตโนมัติจาก `User.employeeCode`  
ย้ายสาขา = เปลี่ยน `branchId` / `PersonnelBranch` คง `rosterNo` — ยังไม่สร้างตารางประวัติ  
ลาออก = อนาคตใช้สถานะ / `isActive` ไม่ใช่ soft-delete เป็นค่าเริ่ม  
จ้างกลับ = ใช้ `rosterNo` เดิมในบริษัทเดียวกัน  
`User.employeeCode` คงเป็นของ IAM จนกว่ามีโครงการ map ชัด

---

## Employment vs account status

`User.isActive` / `User.deletedAt` = สถานะบัญชี  
`Personnel.isActive` / `Personnel.deletedAt` = สถานะในทะเบียน (Phase 1 เขียนได้; ลบ = soft-delete + isActive false)

Enum ภายหลังเมื่อ HR กรองรายสัปดาห์: `ACTIVE | ON_LEAVE | SUSPENDED | RESIGNED | TERMINATED`  
ห้ามยืม `VehicleStatus`

---

## โมดูลผู้บริโภค

| ผู้บริโภค | วันนี้ | Phase 1 (หลังคำสั่ง) | Future | Deferred |
|---|---|---|---|---|
| HR / Attendance | Personnel | อัปเดต/ลบ + isActive + list ตามสาขา (landed) | แผนก optional (`departmentId`) landed | Payroll / leave |
| IAM | User; `userId` ว่างได้ | โยง `userId` เมื่อต้องโชว์คู่ (landed) | — | บังคับทุก User มี Personnel |
| Finance | employeeId → User | คงของเดิม | remap เมื่อบิลต้องผูกคนไม่มีล็อกอิน | HR source adapter |
| Transport | Driver ล้วน | คงของเดิม | `Driver.personnelId?` | บังคับทุกคนขับมี Personnel |
| Maintenance / WO | User / Role | คงของเดิม | assignee → Personnel เมื่อช่างไม่มีล็อกอิน | Technician table ใหม่ |
| Production | ไม่มีโมดูล | — | Worker = Personnel | ProductionPersonnel |
| Asset | ไม่มี custodian | ห้าม FK | `personnelId` หลัง Asset Phase 2/3 | userId เป็นผู้ถือครอง |

---

## ห้ามสร้าง (Phase 0 และจนกว่ามีคำสั่ง Phase ถัดไป)

```text
ตาราง Personnel / Employee ชุดที่สอง
PeopleDepartment / HRDepartment
FinanceEmployee / ProductionWorker / ProductionPersonnel
MaintenanceTechnician / AssetCustodian (ตารางแยก)
Person / Party framework
Driver.personnelId
Expense.employeeId → Personnel
Asset.custodian / personnelId
supervisorPersonnelId / supervisor graph บน Personnel
org history / occupancy history / employment enum
dual-hat / รักษาการ (junction คนต่อหลายตำแหน่ง)
Payroll, leave, recruitment, benefits, tax, health
Department = Permission
Department.parentId tree UI (ลำดับชั้นมีชุดเดียวคือ Position)
```

อย่าเปลี่ยน nav `people` — ค่านี้ยังหมายถึง HR UI  
Phase 3-Org เพิ่ม resource `hr_positions` (create|read|update|delete) ได้ — นอกจากนี้ห้ามเพิ่ม resource ใหม่

---

## ลำดับงาน

| เฟส | ทำ | ไม่ทำ | เงื่อนไขเริ่ม |
|---|---|---|---|
| **0** | ADR + Cursor rule + ลิงก์เอกสาร | ตาราง, migrate, API, UI, seed, permission, nav | อนุมัติแผนแล้ว |
| **1** (landed) | อัปเดต/ลบ Personnel + isActive; แก้ list ตามสาขา; โยง userId | ตารางใหม่, Position, Expense/Driver FK | `APPROVE PERSONNEL PHASE 1` |
| **2 arch** | ล็อก Shared Department Master ในเอกสาร | migrate, picker, Position | product ยืนยันต้นไม้ร่วม |
| **2 build** (landed) | `Personnel.departmentId?` + validate สาขา + ขยาย delete-guard + picker | Position, supervisor, ประวัติย้าย | `APPROVE PERSONNEL PHASE 2 BUILD` |
| **3-Org** (unlocked) | `positions` + `Personnel.positionId?` + ผังองค์กร + JD + พิมพ์/ส่งออก | supervisor บน Personnel, ประวัติ, dual-hat, Department tree | คำสั่งมนุษย์ (2026-08-31) |
| **3** | `Driver.personnelId?` และ/หรือ remap Expense employee | รื้อ Driver | approval รายโมดูล |
| **4** | Asset custodian `personnelId` | Asset machine/vehicle FK | หลังคำสั่ง Asset ที่เกี่ยวข้อง |
| **เลื่อน** | supervisor graph, ประวัติย้าย/ครองตำแหน่ง, dual-hat, HRIS เต็ม | — | — |

หลัง Phase 3-Org: **STOP** — ห้ามเริ่ม supervisor graph บน Personnel / org history / dual-hat / Phase 3 (Driver/Expense/Asset FK) โดยไม่มีคำสั่งใหม่

---

## Approval Gate

Phase 1 และ Phase 2 **build** อนุมัติแล้วและลงแล้ว  
เกตต้นไม้ร่วม **ผ่านแล้ว** (คนกับเครื่องใช้ `departments` ชุดเดียวกัน)

Phase 3–4 เริ่มได้เมื่อมี trigger ในตารางด้านบน **บวกคำสั่งชัด**

---

## Definition of Done (Phase 2 build)

- Optional `Personnel.departmentId` ชี้ `departments` ชุดเดียวกับ Machine; ห้าม PeopleDepartment / Position
- Validate แผนก: บริษัทเดียวกัน + `department.branchId` อยู่ในสาขาที่คนถูก assign
- ย้ายสาขาคน/เครื่องแล้วแผนกไม่ valid → เคลียร์ FK; ตั้งแผนกผิดสาขาตอน create/patch ชัด → 400
- ลบ/ย้ายแผนกกันเมื่อยังมี Machine หรือ Personnel (รวม soft-delete) ชี้
- HR list/form/detail เลือกและกรองแผนกได้ — ไม่เพิ่ม permission / nav
- Expense / Driver / Asset FK **ไม่เปลี่ยน**

---

## Definition of Done (Phase 3-Org)

- ตาราง `positions` branch-scoped; `parentId` สาขาเดียวกัน + กันวงกลม + ลึกไม่เกิน 10
- `Personnel.positionId?` validate สาขาแบบเดียวกับ `departmentId`; ย้ายสาขาแล้วไม่ valid → เคลียร์
- `/hr/positions` จัดต้นไม้ตำแหน่งได้ พร้อม JD และ `headcount`
- `/hr/org?view=chart` แสดงผัง กล่อง = ตำแหน่ง + คนที่นั่ง + จำนวนว่าง; `?view=dept` คงมุมมองแผนกเดิม
- หน้าพิมพ์และส่งออก Excel ใช้ข้อมูลชุดเดียวกับผัง
- resource `hr_positions` เท่านั้นที่เพิ่ม; `Personnel.jobGroup` และ FK โมดูลอื่น **ไม่เปลี่ยน**
