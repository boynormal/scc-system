# Module: `hr`

บุคลากร (Personnel), บันทึกเวลา (Attendance), นำเข้า Excel — map จาก `app/(dashboard)/hr/**`, `app/api/hr/**`

โครงสร้างมาตรฐาน: `domain/` → `application/` → `infra/` → `ui/` (เลือกใช้ตามความจำเป็น — ปัจจุบันมีแค่ `application/`)

- `personnel-service.ts` — list/create personnel รวม branch scope ตาม RBAC และ multi-branch assignment
- `attendance-service.ts` — list/delete attendance entries (ตามรายการ หรือทั้งวัน) และนำเข้าจากไฟล์ Excel บันทึกเวลา
- `personnel-branch-utils.ts` — helper ผูก/ย้าย personnel กับ branch (`ensurePersonnelBranch`, `setPersonnelPrimaryBranch`, `replacePersonnelBranchesFromIds`)
- `parse-timesheet-xls.ts` — parser ไฟล์ Excel บันทึกเวลา (`parseTimeSheetXlsBuffer`)

Route ทั้งหมดใน `app/api/hr/**` เป็น thin adapter เรียกฟังก์ชันเหล่านี้ผ่าน `withAuth` — ไม่มี business logic หนักใน route
