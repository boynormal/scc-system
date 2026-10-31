-- Idempotent defaults for Document Center. Run after the add_document_center migration.
-- Does not insert documents or files.

INSERT INTO doc_center_types (company_id, code, name, is_active, updated_at)
SELECT c.id, v.code, v.name, true, now()
FROM companies c
CROSS JOIN (VALUES
  ('FORM', 'แบบฟอร์ม'),
  ('SOP', 'ขั้นตอนมาตรฐาน'),
  ('WI', 'วิธีปฏิบัติงาน'),
  ('MANUAL', 'คู่มือ'),
  ('POLICY', 'นโยบาย'),
  ('CONTRACT', 'สัญญา'),
  ('REPORT', 'รายงาน'),
  ('EVIDENCE', 'หลักฐาน')
) AS v(code, name)
WHERE NOT EXISTS (
  SELECT 1 FROM doc_center_types t WHERE t.company_id = c.id AND t.code = v.code
);

INSERT INTO doc_center_categories (company_id, code, name, sort_order, is_active, updated_at)
SELECT c.id, v.code, v.name, v.sort_order, true, now()
FROM companies c
CROSS JOIN (VALUES
  ('GEN', 'ส่วนกลาง', 1),
  ('HR', 'HR', 2),
  ('FIN', 'Finance', 3),
  ('TRN', 'Transport', 4),
  ('MNT', 'Maintenance', 5),
  ('OPS', 'Operation', 6),
  ('IT', 'IT', 7),
  ('SAF', 'Safety', 8)
) AS v(code, name, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM doc_center_categories cat
  WHERE cat.company_id = c.id AND cat.parent_id IS NULL AND cat.name = v.name
);
