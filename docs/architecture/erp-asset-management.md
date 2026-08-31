# ERP Asset Management Architecture

**สถานะ:** Phase 0 ล็อกแล้ว · **Phase 1 ลงแล้ว** (ตาราง `assets` + CRUD + RBAC + UI `/assets`) · Phase 2 ยังเกต  
กฎเอเจนต์: [`.cursor/rules/erp-asset-management.mdc`](../../.cursor/rules/erp-asset-management.mdc)  
Shared Master: [`erp-shared-master.md`](./erp-shared-master.md)  
Expense SSOT: [`modules/finance/FINANCE-EXPENSE-OWNERSHIP.md`](../../modules/finance/FINANCE-EXPENSE-OWNERSHIP.md)  
โมดูล: [`modules/assets`](../../modules/assets)

> One Asset Master → Many Module Consumers → Finance Financial Layer → Future GL  
> Machine และ Vehicle **ไม่ใช่ลูกบังคับ** ของ Asset

```text
Asset Management
      │
      ▼
 Shared Asset Master          ← ตาราง assets มีแล้ว (Phase 1)
      │                         ยังไม่มี FK ไป Machine / Vehicle
      ├── Maintenance → Machine     (operational master — มีแล้ว)
      ├── Transport   → Vehicle     (operational master — มีแล้ว)
      ├── IT          → IT Asset    (future)
      ├── Facility    → Building / Equipment (future)
      │
      └── Finance → Financial Asset Profile (future)
                         │
                         ▼
                       Future GL
```

---

## ADR

```text
ADR: Asset Management Architecture

Decision:
  Option B — โมดูล Asset Management แยกจาก Finance
  เมื่อสร้างตาราง: Asset เป็น Shared Registration Master แบบบาง
  Machine / Vehicle คงเป็น operational master ของ Maintenance / Transport
  เชื่อมด้วย optional Machine.assetId? / Vehicle.assetId? เท่านั้น
  การเงินของสินทรัพย์อยู่ FinanceAssetProfile ในอนาคต — ไม่ใช่มาสเตอร์ซ้ำ

Status:
  Accepted (2026-08-31) — Phase 0 ล็อกแล้ว
  Phase 1 landed (2026-08-31) — ตาราง assets + CRUD + resource `assets` + nav `asset_register` / `/assets`
  Phase 2 (Machine.assetId / Vehicle.assetId) ยังเกต

Owner:
  ทะเบียน Asset     = Asset Management (`modules/assets` — ไม่ใช่ Settings, ไม่ใช่ Finance)
  Machine           = Maintenance
  Vehicle           = Transport
  Expense           = Finance
  Financial Profile = Finance (เมื่อมี FA / GL)

Scope:
  Phase 0 = วางตัวและความเป็นเจ้าของ
  Phase 1 = ทะเบียนบาง VEHICLE|MACHINE ไม่มี FK ปฏิบัติการ

Why:
  ระบบมี Machine + Vehicle ที่ทำงานและถูกล็อก ownership แล้ว
  Finance เป็น Expense SSOT ไม่ใช่เจ้าของสมุดปฏิบัติการ
  ไม่ใช่ทุกเครื่อง/ทุกรถเป็นทรัพย์สินของบริษัท
  Shared Master ที่มีอยู่สอนว่ามาสเตอร์ชุดเดียว โมดูลอ้าง — ไม่สอนให้รื้อ operational master

Alternatives rejected:
  A  Finance → Fixed Asset เป็นสมุด          — บัญชีเป็นเจ้าของทะเบียน
  C  Asset เป็นพ่อบังคับของ Machine/Vehicle — migration สูง; รถ/เครื่องภายนอกสร้างไม่ได้
  D  FinanceAsset / ITAsset / … ต่อโมดูล    — ซ้ำแบบที่ห้ามกับ Vendor / GL master

Future trigger (Phase 1 ห้ามเริ่มถ้ายังไม่มี):
  คำสั่งชัด + use case แรกอย่างน้อยหนึ่งข้อ:
    • IT Asset Register ที่ใช้จริงทุกสัปดาห์
    • Company Vehicle / Machine Capitalization ตามนโยบายบัญชี

Implementation:
  Phase 0 = เอกสารนี้ + Cursor rule + ลิงก์จาก Shared Master / Vision / Finance SSOT
  Phase 1 = `modules/assets` + `prisma` Asset + `/api/assets` + `/assets` UI
  Phase 2+ = รอคำสั่งใหม่ — ห้ามเพิ่ม assetId บน Machine/Vehicle โดยอัตโนมัติ

Deferred:
  ตาราง Asset, assetId บน Machine/Vehicle, backfill, FA engine, GL,
  Component tree, Location master, Custodian, Transfer, ITAM
```

---

## สิ่งที่มีอยู่แล้ว (FACT)

มีตาราง `assets` (Phase 1) — **ยังไม่มี** `FixedAsset` / `ITAsset` / `FinanceAsset` และ **ยังไม่มี** `assetId` บน Machine / Vehicle

| Entity | ตาราง | Owner | หมายเหตุ |
|---|---|---|---|
| Machine | `machines` | Maintenance | PM / WO / checklist / BOM อะไหล่ — ไม่มีราคาซื้อหรือค่าเสื่อม |
| Vehicle | `transport_vehicles` | Transport | ใบงาน / GPS / ซ่อม / ยาง — ไม่มี VIN หรือกรรมสิทธิ์ |
| SparePart | `spare_parts` | Inventory | สต็อก — ไม่ใช่ Asset |
| Expense | `expenses` | Finance | cost object = type + **label** ไม่มี FK ไปเครื่อง/รถ |
| Supplier / Branch / Unit | settings | Settings | Shared Master ที่ล็อกแล้ว |

คำว่า “Asset” ใน repo **ไม่ใช่สมุดทรัพย์สิน**:

| ที่พบ | ความหมายจริง |
|---|---|
| Nav department `asset_management` | กลุ่ม UI ของ **Machines** ภายใต้ product line Maintenance |
| `machine-asset-service.ts` | รูป / สินค้าบนเครื่อง / BOM อะไหล่ |
| `ExpenseTransactionType.ASSET` | ประเภทธุรกรรมของ ExpenseType — seed ใช้ `EXPENSE` |
| `GPS_ASSET_ID` / `car.asset` | รหัสอุปกรณ์ผู้ให้บริการ GPS |
| Home-screen `assetKind` | ไฟล์ไอคอนหน้า `/apps` |

**Repository behavior มาก่อนชื่อใน UI** — อย่าสรุปว่า Asset Management มีอยู่แล้วเพียงเพราะมี `asset_management`

---

## ความหมายที่ล็อก

```text
Asset          = ทะเบียนตัวตน (รหัสสมุด, กรรมสิทธิ์, สถานะทะเบียน, serial)
Fixed Asset    = มุมบัญชี (ราคาทุน, ค่าเสื่อม, มูลค่าตามบัญชี, GL) — profile ไม่ใช่สมุด
Machine        = หน่วยซ่อมบำรุง          ← Operational Master
Vehicle        = หน่วยกองยาน             ← Operational Master
IT Asset       = ประเภทของ Asset เมื่อมี use case — ห้ามสร้างตาราง ITComputer ล่วงหน้า
SparePart      = Inventory
Facility       = ประเภท Asset เมื่อถือครองอาคาร/อุปกรณ์โรง — ยังไม่มี
Location       = ยังไม่มีมาสเตอร์ (ดูเกณฑ์ใน erp-shared-master.md)
```

```text
Machine  ≠  Asset
Vehicle  ≠  Asset
Asset    ≠  Fixed Asset
ทุกสิ่งที่มีราคา  ≠  Asset
```

เศษเหล็ก / กระดาษ / PET / แบตเตอรี่ที่ซื้อมาขาย = Inventory / วัสดุรีไซเคิล  
อะไหล่ในคลัง = SparePart  
รถซัพพลายเออร์ / เครื่องผู้รับเหมา = operational row โดยไม่มี Asset

---

## ชั้นข้อมูลที่ล็อก

```text
Machine ─────── Operational Master     (Maintenance)
Vehicle ─────── Operational Master     (Transport)
Asset ───────── Shared Registration     (Asset Management — เมื่อมีตาราง)
Finance ─────── Financial Layer         (Expense วันนี้; Financial Profile + GL ภายหลัง)
```

Asset **ไม่ใช่ parent** ของ Machine หรือ Vehicle  
ห้ามบังคับให้ทุก Machine / ทุก Vehicle มีแถว Asset

เมื่อถึง Phase 2 (หลัง approval แยก):

```text
Machine.assetId?          optional
TransportVehicle.assetId? optional
```

ลิงก์เฉพาะของที่บริษัทถือครอง (หรือเช่าที่ต้องตั้งทุน)  
**ห้าม backfill ทั้งก้อนโดยอัตโนมัติ** จนกว่าจะมีข้อมูล ownership และผ่าน Phase 2 approval

---

## Ownership

| Entity | Owner | Shared | Finance | Maintenance | Transport | Inventory | IT |
|---|---|---|---|---|---|---|---|
| Asset | Asset Management | ใช่ | Ref + future Profile | ยังไม่ลิงก์ (Phase 2) | ยังไม่ลิงก์ (Phase 2) | ไม่สร้างซ้ำ | ประเภทของ Asset |
| FinanceAssetProfile | Finance | ไม่ | Owner | — | — | — | — |
| Machine | Maintenance | ไม่ | cost object (label) | Owner | — | BOM อะไหล่ | — |
| Vehicle | Transport | ไม่ | cost object (label) | — | Owner | — | — |
| SparePart | Inventory | ไม่ | ต้นทุนผ่าน WO/Expense | เบิกผ่าน WO | — | Owner | — |
| Expense | Finance | SSOT เงิน | Owner | ห้ามตารางซ้ำ | ยอดอ้างอิงเท่านั้น | ห้ามตารางซ้ำ | — |
| Supplier / Branch / Unit | Settings | ใช่ | Ref | Ref | Ref | Ref | Ref |

Asset ไม่ได้อยู่ใต้ Settings (Settings ถือของบางที่อ้างทุกโมดูล) และไม่ได้อยู่ใต้ Finance

หลัก: **One Asset Master → Many Module Consumers**  
ห้าม `FinanceAsset` · `MaintenanceAsset` · `TransportAsset` · `ITAsset` (ตารางแยก) · `ProductionAsset` · `GLAsset`

---

## รหัสที่ห้ามปน

```text
Asset.code      ≠  Machine.code
Asset.code      ≠  plateNumber
Asset.code      ≠  serialNumber
serialNumber    =  หมายเลขผู้ผลิต (optional)
plateNumber     =  ทะเบียนรถ — อยู่ที่ Vehicle
Machine.code    =  รหัสเครื่องต่อสาขา — อยู่ที่ Machine
```

---

## Lifecycle (แนวคิด — ยังไม่ implement)

สองวงจรคนละชุด:

| วงจร | สถานะ (เมื่อมีตาราง) | Owner |
|---|---|---|
| ทะเบียน | registered → active → idle → retired → disposed | Asset |
| ปฏิบัติการ | `Machine.status` / `Vehicle.currentStatus` | Maintenance / Transport |
| บัญชี (อนาคต) | draft → capitalized → depreciating → fully depreciated → disposed | Finance |

`Asset = active` และ `Financial = fully depreciated` ได้พร้อมกัน  
ห้ามย้าย `under_maintenance` / `on_job` มาเป็นสถานะ Asset

สร้าง Asset ตอน **คนกด Register** หลังรับของที่ตั้งใจใช้ — ไม่สร้างตอน PO / ใบแจ้งหนี้ / จ่ายเงิน  
ของรีไซเคิลที่ซื้อมาขายไม่เข้า Register

---

## Location / สาขา / ผู้ถือครอง

Phase 1 (เมื่อมีคำสั่ง): `companyId` + `branchId` + `locationDetail` สตริง  
ห้ามสร้าง Location master เพราะ Asset — เกณฑ์เดิมอยู่ที่ [erp-shared-master.md](./erp-shared-master.md)

ยังไม่แยก `ownerBranchId` / `currentBranchId` และยังไม่มี `AssetTransfer`

ผู้ถือครองเมื่อมี use case: `personnelId` — **ไม่ใช่** `userId`  
`User` = login · `Personnel` = การจ้าง · `Driver` = บทขนส่ง

---

## Finance

วันนี้: Expense + cost object label ตาม Phase 4 ที่ล็อกไว้ — **ไม่เปลี่ยน**

อนาคต (Phase 4 ของแผนนี้ หลังมี CoA / Product Decision):

```text
Asset
  └── FinanceAssetProfile    ← acquisition, useful life, depreciation, book value, disposal
        └── future GL        ← อ้าง assetId เดิม ห้าม GLAsset
```

`ExpenseTransactionType.ASSET` ไม่ใช่สมุดทรัพย์สิน

---

## ห้ามสร้าง (หลัง Phase 1 — จนกว่าจะมีคำสั่ง Phase 2+)

```text
Machine.assetId / Vehicle.assetId
Backfill จาก machines / transport_vehicles
FixedAsset / ITAsset / FinanceAsset / GLAsset
VehicleProfile / MachineProfile ที่ย้ายคอลัมน์จากตารางที่มีอยู่
MaintenanceAsset / TransportAsset / AssetVehicle
Location master, Component tree, Custodian, Transfer history
Depreciation engine, auto-capitalize, auto-backfill
IT / EQUIPMENT / BUILDING types
Party / Person / Global Asset hierarchy / ITAM / Digital Twin
```

อย่าเปลี่ยน nav `asset_management` — ค่านี้ยังหมายถึง Machines  
Phase 1 ใช้ department ใหม่ `asset_register` + `/assets`

---

## ลำดับงาน

| เฟส | ทำ | ไม่ทำ | เงื่อนไขเริ่ม |
|---|---|---|---|
| **0** | ADR + Cursor rule + ลิงก์เอกสาร | ตาราง, API, UI, seed, permission, nav | อนุมัติแผนแล้ว |
| **1** (ลงแล้ว) | ตาราง Asset บาง + CRUD + `assets` RBAC + `/assets` | FA, assetId บน Machine/Vehicle, backfill | คำสั่ง BUILD + use case capitalization |
| **2** | `Machine.assetId?` / `Vehicle.assetId?` ลิงก์ทีละแถว | auto-backfill ทั้งก้อน | ข้อมูล ownership + approval แยก |
| **3** | Transfer / custodian / history เมื่อมี requirement | engine ใหญ่ | use case รายสัปดาห์ |
| **4** | FinanceAssetProfile + ค่าเสื่อมเมื่อมี CoA | GL master ซ้ำ | Product Decision การเงิน |
| **เลื่อน** | Component, Location, ITAM, IoT twin, Party | — | — |

หลัง Phase 1: **STOP** — ห้ามเริ่ม Phase 2 โดยอัตโนมัติ

---

## Approval Gate

Phase 1 **ลงแล้ว** (use case: Company Vehicle / Machine Capitalization)

Phase 2 เริ่มได้เมื่อมีข้อมูลว่าแถวไหนเป็นของบริษัท / เช่า / ของภายนอก และมี rollback (FK เป็น null ได้; WO / Job เก่ายังอ่าน `machineId` / `vehicleId`) **บวกคำสั่งชัด**

---

## Definition of Done (Phase 1)

- Migration `assets` ว่าง — ไม่ backfill จาก machines / vehicles
- CRUD ตรวจ company / branch / supplier และรหัสไม่ซ้ำในบริษัท
- RBAC `assets` แค่ create|read|update|delete
- UI `/assets` ใช้งานได้; nav `asset_management` (Machines) ไม่ถูกเขียนทับ
- `modules/assets` ไม่ query ตาราง Machine / Vehicle / Expense
- Phase 2 ยังเกต
