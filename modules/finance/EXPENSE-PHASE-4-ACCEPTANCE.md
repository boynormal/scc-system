# Expense Phase 4 — Acceptance Evidence

**Status:** CLOSED (8/8)  
**Date:** 2026-08-29  
**Scope:** Dynamic form + server validation (`requires_*`, allowlists, header vendor, Unit master, `LOCATION`)  
**Not in scope:** Chart of Accounts, GL FK, journal/posting, Location master, per-line vendor

Do **not** change the locked rules below unless product explicitly reopens Phase 4.  
Regression tests: `modules/finance/application/__tests__/expense-phase4-acceptance.test.ts`

## Locked rules

- Server (`resolveBill` → `assertLineDimensions` / `assertHeaderVendor`) is the source of truth. Client validation is UX only.
- Rules apply on **create and PATCH only**. GET / list must not fail on historical bills.
- `requiresVendor` → header `Expense.vendorId`. If **any** line type requires vendor and header vendor is null → reject. No per-line vendor.
- `requiresCostCenter` → line `costCenterId`. `requiresProcess` → line `processId`.
- `requiresVehicle` / `requiresMachine` / `requiresLocation` → matching `costObjectType` + non-empty `costObjectLabel`.
- Allowlist: any `isAllowed` map → selection must be in that set; empty input uses `isDefault`. **No maps** → any **active** company CC / Process.
- Legacy types (`FUEL`, `TOLL`, `OTHER`, …) with `requires_* = false` and no maps stay unrestricted.
- `QTY_PRICE` requires `unitId` from shared Unit master; persist `Unit.code` into `unitCode`. `AMOUNT`: `quantity = 1`, `unitId = null`.
- IMPORT/MODULE: amounts stay locked; type / CC / process / cost object stay editable.
- `defaultGlLabel` is a read-only hint. Not an FK. Not posted.

## Live run fixtures (DEMO)

| Role | Type used |
|------|-----------|
| บิลธรรมดา | `OTHER` อื่นๆ (no type named «ค่าใช้จ่ายทั่วไป» in seed) |
| น้ำมัน | `EXP-0301` น้ำมันเชื้อเพลิง (`requiresVendor/CC/process/vehicle`, CC+process defaults) |
| ค่าซ่อม | `EXP-0602` ค่าซ่อมรถ |
| Location | `EXP-0401` ค่าน้ำ |
| No mapping | `EXP-0202` ค่าทางด่วน (requires CC/process/vehicle, no maps) |
| Vendor | Thai Industrial Parts Co. |
| Unit | `L` |
| Allowlist reject | CC `MAINTENANCE` / ซ่อมบำรุง (not in EXP-0301 maps) |

Bills created during the run (`EXP-2026-00004` … `00009`) were soft-deleted after the run.

## Results — 8/8

| # | Scenario | UI | API |
|---|----------|----|-----|
| 1 | Unrestricted type, no vendor/CC/process | allow | save |
| 2 | Fuel with vendor + default CC/process + vehicle + unit `L` | allow | save; fields persisted |
| 3 | Fuel without vehicle label | warn `ต้องระบุรถ` | reject same message |
| 4 | CC outside allowlist | dropdown hides it (4 of 5 active); warn if forced | reject `หน่วยงานต้นทุนไม่อยู่ในรายการที่อนุญาต` |
| 5 | Type with no maps | all 5 active CC + 11 active processes | save with any active pair |
| 6 | `requiresLocation` | empty label → `ต้องระบุสถานที่` | reject; `LOCATION` + label saves |
| 7 | Mixed lines (fuel + OTHER + repair) | header vendor required | reject without vendor; 3-line save with vendor |
| 8 | Create → GET detail → PATCH → GET | — | type, CC, process, unit, cost object survive edit |

## Re-run

```bash
npx vitest run modules/finance/application/__tests__/expense-phase4-acceptance.test.ts
```
