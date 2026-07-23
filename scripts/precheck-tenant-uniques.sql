-- Phase A precheck: DB tenant isolation composite unique constraints
-- ตรวจสอบว่าไม่มี duplicate ตาม composite key ใหม่ ก่อนรัน `npx prisma db push`
-- (ตาม docs/architecture/db-blueprint.md หัวข้อ 2.1)
--
-- คาดหวังผลลัพธ์: ทุก query ต้องคืนแถวเป็น 0 แถว (empty result set)
-- เนื่องจากทุกฟิลด์เหล่านี้มี @unique ระดับ global บังคับอยู่แล้ว การเพิ่ม composite unique
-- คู่กันจึงไม่มีทางมี duplicate ได้ตราบใดที่ global unique ยังบังคับอยู่ — script นี้มีไว้เพื่อ
-- ยืนยันเป็นเอกสารตามระเบียบวิธี ไม่ใช่เพราะคาดว่าจะพบปัญหาจริง

-- 1) suppliers: (company_id, code)
SELECT company_id, code, COUNT(*) AS dup_count
FROM suppliers
GROUP BY company_id, code
HAVING COUNT(*) > 1;

-- 2) spare_parts: (company_id, code)
SELECT company_id, code, COUNT(*) AS dup_count
FROM spare_parts
GROUP BY company_id, code
HAVING COUNT(*) > 1;

-- 3) machines: (branch_id, code)
-- หมายเหตุ: machines ไม่มีคอลัมน์ company_id ตรง ๆ (ต้อง join ผ่าน branches ถ้าต้องการ company scope)
-- Phase A นี้ใช้ branch scope ตามที่มีคอลัมน์ branch_id อยู่แล้วบนตาราง
SELECT branch_id, code, COUNT(*) AS dup_count
FROM machines
GROUP BY branch_id, code
HAVING COUNT(*) > 1;

-- 4) work_orders: (branch_id, wo_number)
SELECT branch_id, wo_number, COUNT(*) AS dup_count
FROM work_orders
GROUP BY branch_id, wo_number
HAVING COUNT(*) > 1;

-- 5) users: (company_id, email)
SELECT company_id, email, COUNT(*) AS dup_count
FROM users
GROUP BY company_id, email
HAVING COUNT(*) > 1;

-- 6) users: (company_id, employee_code) — employee_code เป็น nullable, NULL ไม่ถือเป็น duplicate กัน
SELECT company_id, employee_code, COUNT(*) AS dup_count
FROM users
WHERE employee_code IS NOT NULL
GROUP BY company_id, employee_code
HAVING COUNT(*) > 1;
