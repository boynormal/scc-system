# Module: `assets`

ทะเบียนสินทรัพย์ร่วม (Shared Asset Register) เฟส 1 — บันทึกตัวตนรถ/เครื่องของบริษัทหรือที่เช่าเพื่อตั้งทุน

หน้า UI: `app/(dashboard)/assets/**`
- `/assets` รายการ + ค้นหา + กรอง
- `/assets/new` สร้าง
- `/assets/[id]` รายละเอียด
- `/assets/[id]/edit` แก้ไข

API: `app/api/assets/**` (thin adapter → application services)

**ไม่** query ตาราง Machine / Vehicle / WorkOrder / TransportJob / Expense  
**ไม่** มี `Machine.assetId` / `Vehicle.assetId` ในเฟสนี้

`Asset.code` ไม่ใช่ `Machine.code` / ทะเบียนรถ / หมายเลขซีเรียล  
รหัสแนะนำ (ไม่บังคับ): `AST-{year}-{#####}`
