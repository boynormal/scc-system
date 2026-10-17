# Module: `hr`

บุคลากร (Personnel) และบันทึกเวลา (Attendance) จากเครื่องสแกนนิ้ว HIP PremiumTime ของแต่ละสาขา — map จาก `app/(dashboard)/hr/**`, `app/api/hr/**`, `app/api/device-sync/**`

โครงสร้างมาตรฐาน: `domain/` → `application/` → `infra/` → `ui/` (เลือกใช้ตามความจำเป็น — ปัจจุบันมีแค่ `application/`)

- `personnel-service.ts` — list/get/create/update/soft-delete personnel รวม branch scope ตาม RBAC, `isActive`, โยง `userId`, และแนะนำ `rosterNo` ถัดไปทั้งบริษัท
- `personnel-branch-utils.ts` — helper ผูก/ย้าย personnel กับ branch (`ensurePersonnelBranch`, `setPersonnelPrimaryBranch`, `replacePersonnelBranchesFromIds`)

## Attendance (HIP PremiumTime)

```text
Pm2014.mdb (สาขา) → โปรแกรม HIP Sync → POST /api/device-sync/hip/batch (Bearer device key)
  → attendance_badges (เลขสแกนต่อเครื่อง) + attendance_punches (สแกนดิบ, ไม่แก้ไข)
  → HR ผูก badge กับ personnel → attendance_days (สรุปรายวันต่อคนต่อสาขา)
```

- `attendance-access.ts` — สิทธิ์ `hr_attendance` ต่อสาขา (รวม branch sharing ของ `personnel`)
- `attendance-daily-summary.ts` — ฟังก์ชันบริสุทธิ์: วันที่ตาม `Branch.timezone`, ตัดสแกนซ้ำภายใน 1 นาที, เข้า/ออก/นาทีทำงาน
- `attendance-day-rebuild.ts` — สร้าง `attendance_days` ใหม่จาก punches
- `attendance-device-service.ts` — เครื่องสแกน + API key (`hip_<prefix>_<secret>`, เก็บ prefix + sha256 เท่านั้น), `authenticateDevice`
- `attendance-sync-service.ts` — `ingestHipBatch` (สูงสุด 2,000 แถว/ครั้ง, กันซ้ำด้วย unique `[deviceId, badgeId, punchAt]`, `lastSourceRowId` ไม่ลดลง)
- `attendance-badge-service.ts` — รายการ badge + คู่ที่แนะนำ (`rosterNo` = เลขสแกน ในสาขาเดียวกัน), ผูก/ยกเลิกผูกแล้ว rebuild วัน
- `attendance-day-service.ts` — มุมมองรายวันของสาขา และเวลาสแกนทุกครั้งของคนหนึ่งในวันหนึ่ง

การนำเข้าไม่สร้าง `Personnel` อัตโนมัติ — badge ที่ยังไม่ผูกเก็บ punches ไว้ (`personnelId = null`) จนกว่า HR จะผูก

ตั้ง `HIP_SYNC_LATEST_VERSION` ใน env เพื่อให้โปรแกรมสาขาเตือนเมื่อมีเวอร์ชันใหม่ (ไม่บังคับ)

ทดสอบกับข้อมูลจริง: `npx tsx scripts/hip-sync-smoke.ts <export.json> http://localhost:3000`

Route ทั้งหมดใน `app/api/hr/**` เป็น thin adapter เรียกฟังก์ชันเหล่านี้ผ่าน `withAuth`; `app/api/device-sync/**` ใช้ `withDeviceAuth` (`lib/device-api-handler.ts`) และอยู่ใน `PUBLIC_PATHS` ของ middleware
