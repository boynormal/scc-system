# ERP Shared Master Data

**สถานะ:** Architecture lock (P1) — เอกสารและกฎเท่านั้น ไม่มีตารางคู่ค้าใหม่  
กฎเอเจนต์: [`.cursor/rules/erp-shared-master.mdc`](../../.cursor/rules/erp-shared-master.mdc)  
Expense SSOT: [`modules/finance/FINANCE-EXPENSE-OWNERSHIP.md`](../../modules/finance/FINANCE-EXPENSE-OWNERSHIP.md)  
Asset: [`erp-asset-management.md`](./erp-asset-management.md) — ตาราง `assets` มีแล้ว (Phase 1); Phase 2 ยังเกต  
People: [`erp-people-personnel.md`](./erp-people-personnel.md) — ตาราง `personnel` มีแล้ว; ห้ามสมุดคนซ้ำ

> Reuse Master, Don't Duplicate Master  
> Transaction อ้าง Shared Master — ห้ามสร้างสมุดคู่ค้าต่อโมดูล

```text
Shared Master
      ↓
Module Transactions
      ↓
Finance (Expense SSOT)
      ↓
Future GL / AP / AR  (อ้าง id เดิม — ห้ามสร้าง GL master ซ้ำ)
```

---

## ของที่มีอยู่แล้ว (ล็อก)

| Entity | ตาราง / ช่อง | Owner | การใช้ร่วมวันนี้ |
|---|---|---|---|
| Company | `companies` | Settings | Tenant |
| Branch | `branches` | Settings | เกือบทุกโมดูล |
| Supplier | `suppliers` | Settings | `Expense.vendorId`, `SparePart.supplierId` |
| Unit | `units` | Settings | `ExpenseLine.unitId` |
| TmsCustomer | `tms_customers` | Transport | `TransportJob.customerId` (optional) + `customerName` |
| JobStop | `job_stops` | Transport (ธุรกรรม) | snapshot ชื่อ/ที่อยู่/ผู้ติดต่อ — ไม่มี FK ไปลูกค้า |
| Vehicle | `transport_vehicles` | Transport | Finance cost object |
| Machine | `machines` | Maintenance | Finance cost object |
| Personnel | `personnel` | HR | Shared People Master — ลงเวลาวันนี้; `userId?` โยงบัญชีในบริษัทได้ (Phase 1) — [erp-people-personnel.md](./erp-people-personnel.md) |
| Driver | `drivers` | Transport | ไม่มี FK ไป User/Personnel |
| User / Role | `users` | IAM | login; `Expense.employeeId` ชี้ User; `employeeCode` ≠ `rosterNo` |
| Department | `departments` | Settings | Shared Org ต่อสาขา — Machine และ `Personnel.departmentId?` ใช้ชุดเดียวกัน — ห้าม `PeopleDepartment` |
| ExpenseType / Category / Process / CostCenter | Finance | Finance | มิติค่าใช้จ่าย |
| Asset | `assets` | Asset Management | Shared Registration Phase 1 — [erp-asset-management.md](./erp-asset-management.md) |

`Vendor` ใน UI Finance = **Supplier แถวเดียวกัน** (`listExpenseVendors` อ่าน `suppliers`) — ห้ามสร้างตาราง Vendor

`Asset` เป็น Shared Registration แล้ว (Phase 1) — Machine / Vehicle **ไม่ถูกแทนที่** และไม่ต้องมี Asset ทุกแถว  

`Personnel` เป็น Shared People Master แล้ว — ห้ามสร้างสมุดคนซ้ำ; User / Driver **ไม่ถูกแทนที่**

`SparePart.unit` ยังเป็น `String` — ยังไม่ migrate ไป `Unit.id`

---

## Ownership matrix

| Entity | Owner | Shared | Finance | Transport | Maint | Inventory | Purchasing | Sales |
|---|---|---|---|---|---|---|---|---|
| Supplier | Settings | ใช่ | Ref `vendorId` | Ref | Ref | Ref | Ref / owner ของใบซื้อ | Ref |
| Customer | Future Shared | ใช่ (เมื่อมี) | AR ภายหลัง | Ref ใบงาน | — | — | — | Owner ของใบขาย |
| TmsCustomer | Transport | ไม่ | ไม่ | Owner | — | — | — | ห้ามยกทั้งตารางไป Sales |
| Contact | ยังไม่มีตาราง | เมื่อมี | Ref | Ref | — | — | Ref | Ref |
| Branch / Unit | Settings | ใช่ | ใช่ | ใช่ | ใช่ | ใช่ | ใช่ | ใช่ |
| Vehicle | Transport | ไม่ | cost object | Owner | — | — | — | — |
| Machine | Maintenance | ไม่ | cost object | — | Owner | — | — | — |
| Personnel | HR | ใช่ (สมุดคน) | Ref ภายหลัง; employeeId ยังเป็น User | โยง Driver ภายหลัง | assignee ยังเป็น User | — | — | — |
| Driver | Transport | ไม่ | ไม่ | Owner | — | — | — | — |
| User | IAM | login | ผู้สร้าง/ผู้อนุมัติ | ผู้สร้างใบงาน | — | — | — | — |
| ExpenseType / CC / Process | Finance | การเงิน | Owner | — | — | — | — | — |
| Asset | Asset Management | ใช่ (Phase 1) | Ref + future Profile | ยังไม่ลิงก์ Vehicle | ยังไม่ลิงก์ Machine | — | — | — |

---

## ห้ามสร้าง

`FinanceVendor` · `PurchaseSupplier` · `SalesCustomer` · `TransportCustomer`  
`GLSupplier` · `GLCustomer` · `GLVehicle` · `GLMachine`  
`FinanceAsset` · `GLAsset` · `MaintenanceAsset` · `TransportAsset` · `ITAsset` (ตารางแยก)  
`FinanceEmployee` · `ProductionWorker` · `ProductionPersonnel` · `MaintenanceTechnician` · `AssetCustodian` (ตารางแยก)  
`Position` จนกว่ามี use case รายสัปดาห์ — `PeopleDepartment` ห้าม (reuse `departments`) — [erp-people-personnel.md](./erp-people-personnel.md)  
Business Partner / Party / Person framework / Contact กลาง / Address engine  
Location master จนกว่าเข้าเกณฑ์ด้านล่าง  
`Machine.assetId` / `Vehicle.assetId` จนกว่า Asset Phase 2 — [erp-asset-management.md](./erp-asset-management.md)

---

## Customer — target เท่านั้น (ห้ามสร้างตารางตอนนี้)

สร้าง **หนึ่ง** Shared Customer เมื่อ Sales **หรือ** ซื้อของเก่าเริ่มใช้จริง

ขั้นต่ำที่คิดไว้:

```text
Customer
  companyId, code, name, isActive
  phone, email
  taxId          ← เมื่อต้องออกเอกสารภาษี
```

```text
Customer  ≠  Location  ≠  JobStop
```

- ใบงานอาจอ้าง `customerId`
- จุดรับส่ง = `CustomerLocation` ในอนาคต **หรือ** คง JobStop เป็น snapshot
- ห้ามสร้าง `SalesCustomer`

ผู้ซื้อวัสดุรีไซเคิล → Customer  
ผู้ขายของเก่า → **Supplier** (ชุดเดียวกับร้านอะไหล่/ผู้รับเงินบิล)  
บริษัทเดียวกันเป็นได้ทั้งสองแถว — Business Partner เป็น P4

---

## Asset — target เท่านั้น (ห้ามสร้างตารางตอนนี้)

สมุดทะเบียนทรัพย์สินเป็น Shared Master **เมื่อมีโมดูล Asset และ use case แรก**  
รายละเอียดและการล็อก Phase 0: [erp-asset-management.md](./erp-asset-management.md)

```text
Asset  ≠  Machine  ≠  Vehicle  ≠  SparePart  ≠  Expense
```

- Owner เมื่อมีตาราง = **Asset Management** (ไม่ใช่ Settings, ไม่ใช่ Finance)
- Machine / Vehicle คงเป็น operational master — เชื่อมด้วย `assetId?` optional ใน Phase 2 เท่านั้น
- ห้ามบังคับทุกเครื่อง/ทุกรถให้มี Asset
- ห้าม backfill อัตโนมัติ
- ห้าม `FinanceAsset` / `GLAsset` / สมุดซ้ำรายโมดูล

---

## TmsCustomer — ไม่ migrate ตอนนี้

`TmsCustomer` ปนความหมายองค์กรกับจุดรับส่ง อย่ายกทั้งก้อนเป็น Customer

เกณฑ์ให้ **คน** จัดประเภทในภายหลัง (ห้าม auto-merge จากชื่อ):

| แนว Customer / องค์กร | แนวจุดรับส่ง |
|---|---|
| มีใบงานซ้ำหลายใบในชื่อเดียวกัน | ใช้ครั้งเดียวหรือไม่ซ้ำองค์กร |
| ชื่อนิติบุคคล / จะวางบิลหรือขาย | ชื่อลาน โรง แยก กม. |
| จะอยู่ใน AR / Sales | พิกัดเป็นข้อมูลหลัก |

ใบงานเก่ายังอ่าน `tms_customers` ได้จนกว่าจะมี mapping ชัดและ rollback (เก็บ FK เดิมคู่ขนาน)

---

## Contact

ตอนนี้ใช้ฟิลด์ `contactName` / `phone` บน Supplier และ TmsCustomer / JobStop

เมื่อองค์กรหนึ่งมีหลายคนติดต่อ ค่อยเพิ่ม `Contact[]` **ใต้** Supplier และ **ใต้** Customer  
ไม่สร้าง Contact / Party กลาง

ขั้นต่ำเมื่อมีตาราง: name, role/title, phone, email, isPrimary

---

## User / Personnel / Driver

ล็อกเต็ม: [erp-people-personnel.md](./erp-people-personnel.md)

```text
User        = login / สิทธิ์ / ผู้กดปุ่ม
Personnel   = Shared People Master (การจ้าง / ลงเวลา) — ตารางมีแล้ว
Driver      = บทปฏิบัติการขนส่ง (ไม่บังคับมี User หรือ Personnel)
```

ยังไม่สร้าง Person framework หรือตาราง Personnel ชุดที่สอง  
`Personnel.rosterNo` ≠ `User.employeeCode` — ห้ามคัดลอกอัตโนมัติ  
เมื่อ HR ใช้ทะเบียนคนขับจริง: `Driver.personnelId?` แบบ optional — คนขับไม่มี Personnel ใช้ต่อได้  
`Expense.employeeId` ชี้ User อยู่ — อย่าย้ายไป Personnel จนกว่าบิลต้องผูกพนักงานจริง  
Department เป็น Shared Org Master ต่อสาขา (คนกับเครื่องใช้ชุดเดียวกัน) — ห้าม `PeopleDepartment` — [erp-people-personnel.md](./erp-people-personnel.md)

---

## Location — เกณฑ์ว่าเมื่อใดจึงสร้าง

ยังไม่สร้าง Location master

สร้างเมื่ออย่างน้อยหนึ่งข้อเป็นจริง:

- Branch หนึ่งมีหลายจุดย่อยที่ต้องอ้างซ้ำ
- ≥ 2 โมดูลต้องชี้จุดเดียวกัน
- Warehouse / Finance / Maintenance / Transport ใช้จุดร่วมที่ label ไม่พอ

เมื่อมีแล้ว **ห้ามแทนที่อัตโนมัติ:** Branch, ที่อยู่บน Supplier/Customer, JobStop, `Machine.locationDetail`, Expense LOCATION label

---

## Unit

`units` เป็น Shared แล้ว Finance ใช้ `ExpenseLine.unitId`

Inventory ยังใช้ `SparePart.unit` เป็นสตริง — **ไม่ migrate ใน P1**

เมื่อ Inventory พร้อม: `SparePart.unitId` + ตารางเทียบ `"ชิ้น"` / `PCS` / `piece`  
เก็บคอลัมน์สตริงไว้จนกว่า map ครบ ห้ามเดาสตริงเป็นหน่วยโดยไม่มีตารางเทียบ

---

## กันซ้ำ (ยังไม่มี engine)

Detection ≠ Merge — ห้ามรวมอัตโนมัติ

- วันนี้: ชื่อที่ normalize แล้วใกล้กันบน Settings → เตือนได้ ไม่บังคับรวม
- เมื่อมี tax ID บนคู่ค้า: เตือนถ้าซ้ำในบริษัทเดียวกัน

---

## โมดูลใหม่ต้องอ้างอะไร

| ธุรกรรม (เมื่อมี) | FK |
|---|---|
| PurchaseOrder / ซื้อของเก่า | `supplierId` → Supplier |
| SalesOrder / AR | `customerId` → Customer (หลังมีตาราง) |
| TransportJob | `customerId` เมื่อแยกจากจุดแล้ว; ระหว่างนี้ TmsCustomer |
| Expense | `vendorId` → Supplier |
| SparePart | `supplierId` → Supplier |
| AP | `supplierId` → Supplier |
| Asset (เมื่อมี) | `supplierId` → Supplier; `branchId` → Branch — ห้าม AssetSupplier |

รายละเอียดเฉพาะโมดูล (lead time มีบน Supplier แล้ว; เงื่อนไขจ่าย/ภาษีภายหลัง) = ฟิลด์บนหัวหรือ **profile** ไม่ใช่ตารางคู่ค้าใหม่

---

## Migration (ทำเมื่อโมดูลต้องการเท่านั้น)

ไม่ migrate เพื่อความสวยของสถาปัตยกรรม

| งาน | เมื่อไหร่ | เป้า | Rollback |
|---|---|---|---|
| `SparePart.unit` → `unitId` | Inventory พร้อม | Unit.id + ตารางเทียบ | คงสตริงคู่ขนาน |
| แยก TmsCustomer | มี Sales หรือซื้อของเก่า | องค์กร → Customer; จุด → Location | ไม่ลบ `tms_customers`; ใบงานเก่ายังอ่านได้ |
| `Driver.personnelId` | HR ใช้ทะเบียนคนขับ + approval คน | optional FK | Driver ไร้ Personnel ใช้ได้ |
| `Expense.employeeId` → Personnel | บิลต้องผูกพนักงานจริง + approval การเงิน | ค่อยเปลี่ยน | อย่าทำถ้ายังใช้ User |
| โยง `Personnel.userId` | IAM ต้องโชว์คู่ล็อกอิน↔พนักงาน | คอลัมน์มีแล้ว | ตั้ง null ได้ |
| `Machine.assetId?` / `Vehicle.assetId?` | Phase 2 ของ Asset + ข้อมูล ownership + approval แยก | optional FK เฉพาะแถวที่ขึ้นสมุด | ไม่ลบ `machines` / `transport_vehicles`; FK เป็น null ได้ |

ทุกครั้งต้องมี mapping, ประวัติอ่านได้, FK เดิมคู่ขนานช่วงเปลี่ยน

---

## ลำดับงาน

| เฟส | ทำ | ไม่ทำ |
|---|---|---|
| **P1** (สไลซ์นี้) | กฎ + เอกสาร + ล็อก Supplier/Branch/Unit | ตารางใหม่, migrate |
| **P2** | ออกแบบ Customer ขั้นต่ำ, เกณฑ์แยก TmsCustomer, checklist tax ID | สร้างตารางก่อนโมดูลพร้อม |
| **P3** | เมื่อโมดูล live ชี้ Supplier/Customer ตามตารางด้านบน | SalesCustomer / PurchaseSupplier |
| **P4** | Business Partner เมื่อคู่ค้าเดียวเป็นสองบท + เอกสารภาษีชุดเดียว | Party/Person/CRM/merge engine |
| **เลื่อน** | Location master, Asset hierarchy / Component, Position / PeopleDepartment, GL/AP/AR/Tax/Bank | — |

---

## Definition of Done (P1)

- มี Cursor rule + เอกสารนี้ให้ AI/คนไม่สร้าง master ซ้ำ
- วิสัยทัศน์และ Finance SSOT ชี้กฎชุดเดียวกัน
- Schema และพฤติกรรม Expense / Transport / Inventory **ไม่เปลี่ยน**
