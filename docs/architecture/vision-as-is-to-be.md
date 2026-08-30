# MainSys Enterprise — As-Is vs To-Be

เอกสารนี้เทียบ **สถานะจริงของระบบ (As-Is)** กับ **วิสัยทัศน์ระยะยาว (To-Be)** เพื่อไม่ให้สับสนระหว่าง "สิ่งที่ build แล้ว" กับ "ทิศทางในอนาคต" — ดูรายละเอียดการดำเนินการเชิงเทคนิคที่ [modular-folder-blueprint.md](./modular-folder-blueprint.md) และ [core-platform-convention.md](./core-platform-convention.md)

## As-Is (สถานะปัจจุบัน)

```mermaid
flowchart TB
  brand["MainSys Enterprise"]

  subgraph core [Core Platform - convention ไม่ใช่โฟลเดอร์เดียว]
    auth["Auth / Session"]
    iam["Identity - modules/iam"]
    rbac["Authorization - lib/permissions"]
    notif["Notifications"]
    nav["Navigation / apps launcher"]
  end

  subgraph maint [Maintenance Management]
    machines["Machines"]
    plans["Maintenance Plans"]
    wo["Work Orders"]
    reports["Reports"]
  end

  subgraph people [People and Time]
    personnel["Personnel"]
    attendance["Attendance"]
  end

  subgraph inv [Inventory and Spare Parts]
    spareparts["Spare Parts"]
  end

  subgraph transport [Transport Management]
    jobs["Transport Jobs"]
    fleet["Vehicles / Drivers"]
    gps["GPS Monitor"]
  end

  subgraph finance [Finance]
    expenses["Expenses / Review Queue"]
    reports["Expense Reports"]
    masters["ExpenseType / CC / Process"]
  end

  brand --> core
  brand --> maint
  brand --> people
  brand --> inv
  brand --> transport
  brand --> finance
```

| Product line (`/apps`) | สถานะ | หมายเหตุ |
|------------------------|--------|---------|
| การจัดการซ่อมบำรุง (`maintenance_mgmt`) | เต็มรูปแบบ | Dashboard, PM plans, schedules, work orders, reports, machines |
| บุคลากรและเวลา (`people_time`) | เต็มรูปแบบ | `modules/hr` — personnel + attendance + นำเข้า Excel |
| คลังสินค้าและอะไหล่ (`inventory_spares`) | บางส่วน | เน้น spare parts; ยังไม่มีคลังสินค้าทั่วไป/PO; `SparePart.supplierId` → Shared `Supplier` |
| บริหารงานขนส่ง (`transport_ops`) | เต็มรูปแบบ | `modules/transport` — jobs, vehicles, drivers, calendar, GPS monitor |
| การเงินและบัญชี (`finance`) | Expense ใช้งานได้ | `modules/finance` — บิล + review queue + รายงาน; ยังไม่มี GL / AP / AR |
| ตั้งค่าและผู้ดูแลระบบ / Core Platform (`settings_admin`) | เต็มรูปแบบ | users, branches, roles, Shared Master (`Supplier`, `Unit`) — ดู [erp-shared-master.md](./erp-shared-master.md) |

**Core Platform ปัจจุบันเป็น convention ไม่ใช่โฟลเดอร์เดียว** — กระจายอยู่ใน `lib/auth.ts`, `modules/iam`, `lib/permissions.ts`, `modules/notifications`, `shared/navigation/**`, `shared/branding.ts` ดูรายละเอียดที่ [core-platform-convention.md](./core-platform-convention.md)

## To-Be (วิสัยทัศน์ — ยังไม่ implement)

```mermaid
flowchart LR
  current["As-Is including Finance Expense"] -.-> procurement["Procurement"]
  current -.-> sales["Sales / AR"]
  current -.-> gl["GL / AP"]
  current -.-> production["Production / MES"]
  current -.-> ai["AI Module"]
  current -.-> workflow["Workflow Engine"]
  current -.-> files["Files Platform"]
```

| Vision item | สถานะ | เงื่อนไขก่อนเริ่ม |
|-------------|--------|-------------------|
| Procurement | ยังไม่ทำ | PO ชี้ **Shared `Supplier` ที่มีอยู่** — ห้ามสร้าง `PurchaseSupplier`; ดู [erp-shared-master.md](./erp-shared-master.md) |
| Sales / Customer | ยังไม่ทำ | สร้าง **หนึ่ง** Shared Customer เมื่อขายหรือซื้อของเก่าพร้อม — ห้าม `SalesCustomer`; `TmsCustomer` ยังเป็นของ Transport |
| GL / AP / AR | ยังไม่ทำ | รอ Product Decision; อ้าง Supplier/Customer/Branch/Vehicle/Machine เดิม ห้ามสร้าง GL master ซ้ำ |
| Production / MES | ยังไม่ทำ | ระบบนี้เป็น maintenance-centric ไม่ใช่ MES — ต้องมี use case การผลิตจริงก่อนเริ่ม |
| AI Module | ยังไม่ทำ | รอ process ที่ซ้ำและวัด ROI ได้ชัดก่อนลงทุน |
| Workflow Engine กลาง | ยังไม่ทำ | แต่ละโมดูลจัดการ state ของตัวเอง (เช่น `TransportJobStatus`) จนกว่าจะมี flow ข้ามโมดูลที่ซ้ำจริง 2–3 กรณี |
| Files Platform กลาง | ยังไม่ทำ | แต่ละโดเมนจัดการไฟล์ของตัวเอง (รูปเครื่องจักร, แนบใบงานขนส่ง) จนกว่าจะมี use case ร่วมจริง |

## กฎการตัดสินใจ

- **อย่าสร้างโมดูลใหม่ล่วงหน้า** ตามรายชื่อใน To-Be — เริ่มเมื่อมี user story ใช้งานจริงทุกสัปดาห์ + ข้อมูล master ครบพอสร้าง flow แรกได้
- **Reuse Shared Master** — `Supplier` / `Branch` / `Unit` มีแล้ว; ห้ามสร้าง Vendor หรือ Customer ต่อโมดูล — [erp-shared-master.md](./erp-shared-master.md)
- **ทุกโมดูลใหม่เดินตาม playbook เดียวกัน** — ดู [contributing-modules.md](./contributing-modules.md): route คงเดิม → application service → registry → RBAC
- **Core Platform ขยายแบบ convention ก่อน** — ทำเป็น `shared/*` helper หรือ `modules/<capability>/application` ก่อนแยก platform ใหม่ (ดูเงื่อนไขใน [core-platform-convention.md](./core-platform-convention.md#5-เมื่อจะเพิ่ม-core-capability-ใหม่))

## อ้างอิง

- [erp-shared-master.md](./erp-shared-master.md) — Shared Master lock + ownership matrix
- [modular-folder-blueprint.md](./modular-folder-blueprint.md) — โครงสร้างโฟลเดอร์ + สถานะ implementation
- [core-platform-convention.md](./core-platform-convention.md) — core layers + กฎ import
- [contributing-modules.md](./contributing-modules.md) — ขั้นตอนเพิ่มโมดูล/use-case
- [modules/finance/FINANCE-EXPENSE-OWNERSHIP.md](../../modules/finance/FINANCE-EXPENSE-OWNERSHIP.md) — Finance เป็น Expense SSOT
