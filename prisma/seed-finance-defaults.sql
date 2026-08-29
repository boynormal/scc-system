-- Idempotent backfill of default finance master data for existing companies.
INSERT INTO expense_types (company_id, code, name, transaction_type, is_active, updated_at)
SELECT c.id, v.code, v.name, 'EXPENSE'::"ExpenseTransactionType", true, now()
FROM companies c
CROSS JOIN (VALUES
  ('FUEL', 'น้ำมันเชื้อเพลิง'),
  ('TOLL', 'ค่าทางด่วน'),
  ('LABOR', 'ค่าแรง'),
  ('REPAIR', 'ค่าซ่อม'),
  ('RENT', 'ค่าเช่า'),
  ('UTILITY', 'ค่าสาธารณูปโภค'),
  ('OTHER', 'อื่นๆ')
) AS v(code, name)
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO cost_centers (company_id, code, name, is_active, updated_at)
SELECT c.id, v.code, v.name, true, now()
FROM companies c
CROSS JOIN (VALUES
  ('TRANSPORT', 'ขนส่ง'),
  ('PRODUCTION', 'ผลิต'),
  ('MAINTENANCE', 'ซ่อมบำรุง'),
  ('WAREHOUSE', 'คลังสินค้า'),
  ('ADMIN', 'สำนักงาน/บริหาร')
) AS v(code, name)
ON CONFLICT (company_id, code) DO NOTHING;

-- ── Expense Master taxonomy (Phase 1-2) backfill ─────────────────────────────
-- Categories (10)
INSERT INTO expense_categories (company_id, code, name, sequence, is_active, updated_at)
SELECT c.id, v.code, v.name, v.seq, true, now()
FROM companies c
CROSS JOIN (VALUES
  ('01', 'บุคลากร', 1),
  ('02', 'ขนส่ง', 2),
  ('03', 'เชื้อเพลิงและน้ำมันหล่อลื่น', 3),
  ('04', 'สาธารณูปโภค', 4),
  ('05', 'ค่าเช่าและอสังหาริมทรัพย์', 5),
  ('06', 'ซ่อมบำรุง', 6),
  ('07', 'วัสดุดำเนินงาน', 7),
  ('08', 'การแพทย์และสวัสดิการ', 8),
  ('09', 'ราชการและข้อกำหนด', 9),
  ('10', 'สำนักงานและบริหาร', 10)
) AS v(code, name, seq)
ON CONFLICT (company_id, code) DO NOTHING;

-- Processes (11)
INSERT INTO processes (company_id, code, name, is_active, updated_at)
SELECT c.id, v.code, v.name, true, now()
FROM companies c
CROSS JOIN (VALUES
  ('PROC-COLLECTION', 'เก็บขน / จัดเก็บ'),
  ('PROC-DELIVERY', 'จัดส่ง'),
  ('PROC-WAREHOUSE', 'คลังสินค้า'),
  ('PROC-PET', 'กระบวนการ PET'),
  ('PROC-PAPER', 'กระบวนการกระดาษ'),
  ('PROC-METAL', 'กระบวนการโลหะ'),
  ('PROC-VEHICLE-MAINTENANCE', 'ซ่อมบำรุงยานพาหนะ'),
  ('PROC-MACHINE-MAINTENANCE', 'ซ่อมบำรุงเครื่องจักร'),
  ('PROC-ADMIN', 'บริหารงานทั่วไป'),
  ('PROC-HR', 'ทรัพยากรบุคคล'),
  ('PROC-COMPLIANCE', 'การปฏิบัติตามกฎระเบียบ')
) AS v(code, name)
ON CONFLICT (company_id, code) DO NOTHING;

-- Expense items (EXP-####) with cost classification + required-dimension metadata.
-- category_id resolved from the item code's first two digits. New columns only;
-- legacy expense types are untouched.
INSERT INTO expense_types (
  company_id, category_id, code, name, subcategory, transaction_type,
  default_cost_type, default_directness, default_gl_label,
  requires_vendor, requires_vehicle, requires_machine,
  requires_location, requires_cost_center, requires_process,
  is_active, updated_at
)
SELECT
  c.id,
  cat.id,
  v.code, v.name, v.subcategory, 'EXPENSE'::"ExpenseTransactionType",
  NULLIF(v.cost_type, '')::"ExpenseCostType",
  NULLIF(v.directness, '')::"ExpenseDirectness",
  v.name,
  v.req_vendor, v.req_vehicle, v.req_machine,
  v.req_location, v.req_cost_center, v.req_process,
  true, now()
FROM companies c
CROSS JOIN (VALUES
  ('EXP-0101', 'เงินเดือนและค่าจ้าง', 'Salary & Wage', 'FIXED', 'INDIRECT', false, false, false, false, true, false),
  ('EXP-0102', 'ค่าพิเศษ / Incentive', 'Incentive', 'MIXED', '', false, false, false, false, true, false),
  ('EXP-0103', 'ค่าล่วงเวลา / ทำงานนอกเวลา', 'Overtime', 'VARIABLE', '', false, false, false, false, true, false),
  ('EXP-0201', 'ค่าขนส่งภายนอก', 'Outsourced Transport', 'VARIABLE', 'DIRECT', true, false, false, false, true, true),
  ('EXP-0202', 'ค่าทางด่วน', 'Toll / Expressway', 'VARIABLE', 'DIRECT', false, true, false, false, true, true),
  ('EXP-0203', 'ค่าเที่ยว / เบี้ยเลี้ยงเดินทาง', 'Driver Allowance', 'VARIABLE', 'DIRECT', false, false, false, false, true, true),
  ('EXP-0204', 'ค่าชั่งน้ำหนัก', 'Weighing Fee', 'VARIABLE', 'DIRECT', true, false, false, false, true, true),
  ('EXP-0205', 'ค่าธรรมเนียมการขนส่ง', 'Transport Fee', 'VARIABLE', 'DIRECT', true, false, false, false, true, true),
  ('EXP-0301', 'น้ำมันเชื้อเพลิง', 'Fuel', 'VARIABLE', '', true, true, false, false, true, true),
  ('EXP-0302', 'LPG / Gas', 'LPG / Gas', 'VARIABLE', '', true, true, false, false, true, true),
  ('EXP-0303', 'น้ำมันเครื่อง', 'Engine Oil', 'VARIABLE', 'DIRECT', true, true, false, false, true, true),
  ('EXP-0304', 'น้ำมันเกียร์', 'Gear Oil', 'VARIABLE', 'DIRECT', true, true, false, false, true, true),
  ('EXP-0305', 'น้ำมันเบรก', 'Brake Fluid', 'VARIABLE', 'DIRECT', true, true, false, false, true, true),
  ('EXP-0306', 'น้ำมันไฮดรอลิค', 'Hydraulic Oil', 'VARIABLE', 'DIRECT', true, false, true, false, true, true),
  ('EXP-0307', 'จารบี', 'Grease', 'VARIABLE', 'DIRECT', true, false, true, false, true, true),
  ('EXP-0401', 'ค่าน้ำ', 'Water', 'MIXED', '', true, false, false, true, true, false),
  ('EXP-0402', 'ค่าไฟฟ้า', 'Electricity', 'MIXED', '', true, false, false, true, true, false),
  ('EXP-0403', 'ค่า Internet', 'Internet', 'FIXED', 'INDIRECT', true, false, false, false, true, false),
  ('EXP-0404', 'ค่าโทรศัพท์', 'Telephone', 'MIXED', 'INDIRECT', true, false, false, false, true, false),
  ('EXP-0501', 'ค่าเช่าอาคาร / สถานที่', 'Building Rent', 'FIXED', 'INDIRECT', true, false, false, true, true, false),
  ('EXP-0502', 'ค่าเช่าที่ดิน', 'Land Rent', 'FIXED', 'INDIRECT', true, false, false, true, true, false),
  ('EXP-0601', 'ค่าอะไหล่', 'Spare Parts', 'VARIABLE', 'DIRECT', true, false, true, false, true, true),
  ('EXP-0602', 'ค่าซ่อมรถ', 'Vehicle Repair', 'VARIABLE', 'DIRECT', true, true, false, false, true, true),
  ('EXP-0603', 'ค่าบำรุงรักษารถ', 'Vehicle Maintenance', 'MIXED', 'DIRECT', true, true, false, false, true, true),
  ('EXP-0604', 'ค่าบำรุงรักษาเครื่องจักร', 'Machine Maintenance', 'MIXED', 'DIRECT', true, false, true, false, true, true),
  ('EXP-0701', 'น้ำดื่ม / น้ำแข็ง', 'Drinking Water', 'VARIABLE', 'INDIRECT', true, false, false, false, true, false),
  ('EXP-0702', 'ถุง / บรรจุภัณฑ์', 'Packaging', 'VARIABLE', 'DIRECT', true, false, false, false, true, true),
  ('EXP-0703', 'PPE / อุปกรณ์ความปลอดภัย', 'Safety Supplies', 'VARIABLE', '', true, false, false, false, true, false),
  ('EXP-0704', 'วัสดุสิ้นเปลือง', 'Consumables', 'VARIABLE', '', true, false, false, false, true, false),
  ('EXP-0705', 'วัสดุสำนักงาน', 'Office Supplies', 'VARIABLE', 'INDIRECT', true, false, false, false, true, false),
  ('EXP-0801', 'ค่ารักษาพยาบาล', 'Medical Expense', 'VARIABLE', 'INDIRECT', true, false, false, false, true, false),
  ('EXP-0802', 'ยาและเวชภัณฑ์', 'Medical Supplies', 'VARIABLE', 'INDIRECT', true, false, false, false, true, false),
  ('EXP-0901', 'ภาษีป้าย', 'Signboard Tax', 'FIXED', 'INDIRECT', false, false, false, true, true, false),
  ('EXP-0902', 'ภาษีที่ดินและสิ่งปลูกสร้าง', 'Property Tax', 'FIXED', 'INDIRECT', false, false, false, true, true, false),
  ('EXP-0903', 'ค่าธรรมเนียมใบอนุญาต', 'License Fee', 'FIXED', 'INDIRECT', true, false, false, false, true, false),
  ('EXP-0904', 'ค่าธรรมเนียมราชการ / การขนส่ง', 'Government Fee', 'MIXED', '', true, false, false, false, true, true),
  ('EXP-0905', 'ค่าปรับและเบี้ยปรับ', 'Penalty', 'VARIABLE', 'INDIRECT', false, false, false, false, true, false)
) AS v(code, name, subcategory, cost_type, directness,
       req_vendor, req_vehicle, req_machine, req_location, req_cost_center, req_process)
LEFT JOIN expense_categories cat ON cat.company_id = c.id AND cat.code = substring(v.code from 5 for 2)
ON CONFLICT (company_id, code) DO NOTHING;
