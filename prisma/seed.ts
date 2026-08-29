import { PrismaClient, MachineStatus } from "@prisma/client"
import bcrypt from "bcryptjs"
import { DEFAULT_ROLE_PERMISSIONS } from "../lib/permissions"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Seeding database...")

  // ── Company ────────────────────────────────────────────────────────────────
  const company = await prisma.company.upsert({
    where: { code: "DEMO" },
    update: {},
    create: {
      code: "DEMO",
      name: "Demo Manufacturing Co., Ltd.",
      isActive: true,
    },
  })
  console.log("✅ Company created:", company.name)

  // ── Branch ─────────────────────────────────────────────────────────────────
  const branch = await prisma.branch.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      companyId: company.id,
      code: "HQ",
      name: "สำนักงานใหญ่",
      address: "กรุงเทพมหานคร",
      timezone: "Asia/Bangkok",
      isActive: true,
    },
  })
  console.log("✅ Branch created:", branch.name)

  // ── Department ─────────────────────────────────────────────────────────────
  const dept = await prisma.department.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      branchId: branch.id,
      code: "MAINT",
      name: "แผนกซ่อมบำรุง",
      isActive: true,
    },
  })
  console.log("✅ Department created:", dept.name)

  // ── Roles ──────────────────────────────────────────────────────────────────
  const roleNames = ["Admin", "Manager", "Technician", "Viewer"] as const
  const roles: Record<string, { id: string }> = {}

  for (const roleName of roleNames) {
    const role = await prisma.role.upsert({
      where: { id: `00000000-0000-0000-0000-00000000000${roleNames.indexOf(roleName) + 3}` },
      update: {
        permissions: DEFAULT_ROLE_PERMISSIONS[roleName] as object,
      },
      create: {
        id: `00000000-0000-0000-0000-00000000000${roleNames.indexOf(roleName) + 3}`,
        companyId: company.id,
        name: roleName,
        permissions: DEFAULT_ROLE_PERMISSIONS[roleName] as object,
        isSystem: true,
      },
    })
    roles[roleName] = role
    console.log(`✅ Role created: ${role.name}`)
  }

  // ── Admin User (re-seed always resets password for demo recovery) ──────────
  const adminPasswordHash = await bcrypt.hash("Admin@1234", 12)
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {
      passwordHash: adminPasswordHash,
      deletedAt: null,
      isActive: true,
      username: "admin",
    },
    create: {
      companyId: company.id,
      employeeCode: "EMP001",
      username: "admin",
      email: "admin@demo.com",
      passwordHash: adminPasswordHash,
      firstName: "System",
      lastName: "Admin",
      isActive: true,
    },
  })
  console.log("✅ Admin user:", adminUser.username, adminUser.email)

  await prisma.userBranchRole.upsert({
    where: {
      userId_branchId_roleId: {
        userId: adminUser.id,
        branchId: branch.id,
        roleId: roles["Admin"].id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      branchId: branch.id,
      roleId: roles["Admin"].id,
    },
  })

  // ── Demo test user (Viewer) ─────────────────────────────────────────────────
  const testPasswordHash = await bcrypt.hash("Test@1234", 12)
  const testUser = await prisma.user.upsert({
    where: { email: "test@demo.com" },
    update: {
      passwordHash: testPasswordHash,
      deletedAt: null,
      isActive: true,
      username: "test",
    },
    create: {
      companyId: company.id,
      employeeCode: "EMP002",
      username: "test",
      email: "test@demo.com",
      passwordHash: testPasswordHash,
      firstName: "Demo",
      lastName: "Tester",
      isActive: true,
    },
  })
  console.log("✅ Test user:", testUser.email)

  await prisma.userBranchRole.upsert({
    where: {
      userId_branchId_roleId: {
        userId: testUser.id,
        branchId: branch.id,
        roleId: roles["Viewer"].id,
      },
    },
    update: {},
    create: {
      userId: testUser.id,
      branchId: branch.id,
      roleId: roles["Viewer"].id,
    },
  })

  // ── Machine Categories ─────────────────────────────────────────────────────
  const categories = [
    { code: "ELEC", name: "ระบบไฟฟ้า" },
    { code: "MECH", name: "เครื่องจักรกล" },
    { code: "HVAC", name: "ระบบปรับอากาศ" },
    { code: "PUMP", name: "ปั๊มและท่อ" },
  ]

  const catMap: Record<string, string> = {}
  for (const cat of categories) {
    const c = await prisma.machineCategory.create({
      data: { companyId: company.id, ...cat },
    })
    catMap[cat.code] = c.id
    console.log(`✅ Category created: ${c.name}`)
  }

  // ── Maintenance Types ──────────────────────────────────────────────────────
  const maintenanceTypes = [
    { code: "PM", name: "Preventive Maintenance", color: "#22c55e", requiresShutdown: false },
    { code: "CM", name: "Corrective Maintenance", color: "#f59e0b", requiresShutdown: true },
    { code: "BM", name: "Breakdown Maintenance", color: "#ef4444", requiresShutdown: true },
    { code: "PDM", name: "Predictive Maintenance", color: "#3b82f6", requiresShutdown: false },
  ]

  const typeMap: Record<string, string> = {}
  for (const mt of maintenanceTypes) {
    const t = await prisma.maintenanceType.create({
      data: { companyId: company.id, ...mt },
    })
    typeMap[mt.code] = t.id
    console.log(`✅ Maintenance type created: ${t.name}`)
  }

  // ── Sample Machine ─────────────────────────────────────────────────────────
  const machine = await prisma.machine.upsert({
    where: { branchId_code: { branchId: branch.id, code: "MCH-001" } },
    update: {},
    create: {
      branchId: branch.id,
      departmentId: dept.id,
      categoryId: catMap["ELEC"],
      code: "MCH-001",
      name: "Air Compressor Unit #1",
      model: "AC-500",
      manufacturer: "Atlas Copco",
      serialNumber: "SN2024001",
      installDate: new Date("2022-01-15"),
      warrantyExpireDate: new Date("2027-01-15"),
      status: MachineStatus.active,
      criticalLevel: 3,
      locationDetail: "อาคาร A ชั้น 1",
      createdBy: adminUser.id,
    },
  })
  console.log("✅ Sample machine created:", machine.name)

  // ── Sample Maintenance Plan ────────────────────────────────────────────────
  await prisma.maintenancePlan.create({
    data: {
      machineId: machine.id,
      typeId: typeMap["PM"],
      name: "PM รายเดือน - Air Compressor #1",
      description: "ตรวจสอบและบำรุงรักษาประจำเดือน",
      frequencyUnit: "month",
      frequencyValue: 1,
      estimatedDurationMin: 120,
      startDate: new Date("2024-01-01"),
      leadTimeDays: 7,
      isActive: true,
      createdBy: adminUser.id,
    },
  })
  console.log("✅ Sample maintenance plan created")

  // ── Sample Supplier & Spare Part ──────────────────────────────────────────
  const supplier = await prisma.supplier.upsert({
    where: { companyId_code: { companyId: company.id, code: "SUP001" } },
    update: {},
    create: {
      companyId: company.id,
      code: "SUP001",
      name: "Thai Industrial Parts Co.",
      contactName: "สมชาย ใจดี",
      phone: "02-123-4567",
      email: "contact@thaiparts.co.th",
      leadTimeDays: 7,
      isActive: true,
    },
  })

  const part = await prisma.sparePart.upsert({
    where: { companyId_code: { companyId: company.id, code: "SP001" } },
    update: {},
    create: {
      companyId: company.id,
      supplierId: supplier.id,
      code: "SP001",
      name: "Oil Filter - AC-500",
      unit: "ชิ้น",
      unitCost: 450,
      minStock: 5,
      leadTimeDays: 3,
      isActive: true,
    },
  })

  await prisma.sparePartInventory.upsert({
    where: { partId_branchId: { partId: part.id, branchId: branch.id } },
    update: {},
    create: {
      partId: part.id,
      branchId: branch.id,
      currentStock: 20,
      reservedStock: 0,
    },
  })
  console.log("✅ Sample spare part + inventory created")

  // ── Default Expense Types (Finance) ────────────────────────────────────────
  const expenseTypes: { code: string; name: string }[] = [
    { code: "FUEL", name: "น้ำมันเชื้อเพลิง" },
    { code: "TOLL", name: "ค่าทางด่วน" },
    { code: "LABOR", name: "ค่าแรง" },
    { code: "REPAIR", name: "ค่าซ่อม" },
    { code: "RENT", name: "ค่าเช่า" },
    { code: "UTILITY", name: "ค่าสาธารณูปโภค" },
    { code: "OTHER", name: "อื่นๆ" },
  ]
  for (const et of expenseTypes) {
    await prisma.expenseType.upsert({
      where: { companyId_code: { companyId: company.id, code: et.code } },
      update: { name: et.name },
      create: { companyId: company.id, code: et.code, name: et.name, isActive: true },
    })
  }
  console.log(`✅ Expense types created: ${expenseTypes.length}`)

  // ── Default Cost Centers (Finance) ─────────────────────────────────────────
  const costCenters: { code: string; name: string }[] = [
    { code: "TRANSPORT", name: "ขนส่ง" },
    { code: "PRODUCTION", name: "ผลิต" },
    { code: "MAINTENANCE", name: "ซ่อมบำรุง" },
    { code: "WAREHOUSE", name: "คลังสินค้า" },
    { code: "ADMIN", name: "สำนักงาน/บริหาร" },
  ]
  for (const cc of costCenters) {
    await prisma.costCenter.upsert({
      where: { companyId_code: { companyId: company.id, code: cc.code } },
      update: { name: cc.name },
      create: { companyId: company.id, branchId: branch.id, code: cc.code, name: cc.name, isActive: true },
    })
  }
  console.log(`✅ Cost centers created: ${costCenters.length}`)

  // ── Shared Unit master (Settings → Basic Data → Units) ─────────────────────
  // Idempotent common codes only. Do not migrate Spare Part / Inventory units.
  const commonUnits: { code: string; name: string }[] = [
    { code: "PCS", name: "ชิ้น" },
    { code: "KG", name: "กิโลกรัม" },
    { code: "TON", name: "ตัน" },
    { code: "L", name: "ลิตร" },
    { code: "HOUR", name: "ชั่วโมง" },
    { code: "TIME", name: "ครั้ง" },
    { code: "KM", name: "กิโลเมตร" },
    { code: "DAY", name: "วัน" },
    { code: "JOB", name: "งาน" },
    { code: "TRIP", name: "เที่ยว" },
    { code: "MONTH", name: "เดือน" },
  ]
  for (const u of commonUnits) {
    await prisma.unit.upsert({
      where: { companyId_code: { companyId: company.id, code: u.code } },
      update: {},
      create: { companyId: company.id, code: u.code, name: u.name, isActive: true },
    })
  }
  console.log(`✅ Units created: ${commonUnits.length}`)

  // ── Expense Master Taxonomy (Phase 1-2) ────────────────────────────────────
  // Categories (10), processes (11), and the EXP-#### expense item catalog with
  // cost classification + required-dimension metadata. Legacy expense types
  // (FUEL/TOLL/...) above are left untouched. Idempotent by (companyId, code).

  const expenseCategories: { code: string; name: string; seq: number }[] = [
    { code: "01", name: "บุคลากร", seq: 1 },
    { code: "02", name: "ขนส่ง", seq: 2 },
    { code: "03", name: "เชื้อเพลิงและน้ำมันหล่อลื่น", seq: 3 },
    { code: "04", name: "สาธารณูปโภค", seq: 4 },
    { code: "05", name: "ค่าเช่าและอสังหาริมทรัพย์", seq: 5 },
    { code: "06", name: "ซ่อมบำรุง", seq: 6 },
    { code: "07", name: "วัสดุดำเนินงาน", seq: 7 },
    { code: "08", name: "การแพทย์และสวัสดิการ", seq: 8 },
    { code: "09", name: "ราชการและข้อกำหนด", seq: 9 },
    { code: "10", name: "สำนักงานและบริหาร", seq: 10 },
  ]
  const categoryIdByCode = new Map<string, string>()
  for (const cat of expenseCategories) {
    const r = await prisma.expenseCategory.upsert({
      where: { companyId_code: { companyId: company.id, code: cat.code } },
      update: { name: cat.name, sequence: cat.seq },
      create: { companyId: company.id, code: cat.code, name: cat.name, sequence: cat.seq, isActive: true },
    })
    categoryIdByCode.set(cat.code, r.id)
  }
  console.log(`✅ Expense categories created: ${expenseCategories.length}`)

  const processList: { code: string; name: string }[] = [
    { code: "PROC-COLLECTION", name: "เก็บขน / จัดเก็บ" },
    { code: "PROC-DELIVERY", name: "จัดส่ง" },
    { code: "PROC-WAREHOUSE", name: "คลังสินค้า" },
    { code: "PROC-PET", name: "กระบวนการ PET" },
    { code: "PROC-PAPER", name: "กระบวนการกระดาษ" },
    { code: "PROC-METAL", name: "กระบวนการโลหะ" },
    { code: "PROC-VEHICLE-MAINTENANCE", name: "ซ่อมบำรุงยานพาหนะ" },
    { code: "PROC-MACHINE-MAINTENANCE", name: "ซ่อมบำรุงเครื่องจักร" },
    { code: "PROC-ADMIN", name: "บริหารงานทั่วไป" },
    { code: "PROC-HR", name: "ทรัพยากรบุคคล" },
    { code: "PROC-COMPLIANCE", name: "การปฏิบัติตามกฎระเบียบ" },
  ]
  const processIdByCode = new Map<string, string>()
  for (const p of processList) {
    const r = await prisma.process.upsert({
      where: { companyId_code: { companyId: company.id, code: p.code } },
      update: { name: p.name },
      create: { companyId: company.id, code: p.code, name: p.name, isActive: true },
    })
    processIdByCode.set(p.code, r.id)
  }
  console.log(`✅ Processes created: ${processList.length}`)

  type ReqDim = "vendor" | "vehicle" | "machine" | "location" | "costCenter" | "process"
  type SeedItem = {
    code: string
    name: string
    sub: string
    cost: "FIXED" | "VARIABLE" | "MIXED"
    direct: "DIRECT" | "INDIRECT" | null
    req: ReqDim[]
  }
  const expenseItems: SeedItem[] = [
    { code: "EXP-0101", name: "เงินเดือนและค่าจ้าง", sub: "Salary & Wage", cost: "FIXED", direct: "INDIRECT", req: ["costCenter"] },
    { code: "EXP-0102", name: "ค่าพิเศษ / Incentive", sub: "Incentive", cost: "MIXED", direct: null, req: ["costCenter"] },
    { code: "EXP-0103", name: "ค่าล่วงเวลา / ทำงานนอกเวลา", sub: "Overtime", cost: "VARIABLE", direct: null, req: ["costCenter"] },
    { code: "EXP-0201", name: "ค่าขนส่งภายนอก", sub: "Outsourced Transport", cost: "VARIABLE", direct: "DIRECT", req: ["vendor", "costCenter", "process"] },
    { code: "EXP-0202", name: "ค่าทางด่วน", sub: "Toll / Expressway", cost: "VARIABLE", direct: "DIRECT", req: ["vehicle", "costCenter", "process"] },
    { code: "EXP-0203", name: "ค่าเที่ยว / เบี้ยเลี้ยงเดินทาง", sub: "Driver Allowance", cost: "VARIABLE", direct: "DIRECT", req: ["costCenter", "process"] },
    { code: "EXP-0204", name: "ค่าชั่งน้ำหนัก", sub: "Weighing Fee", cost: "VARIABLE", direct: "DIRECT", req: ["vendor", "costCenter", "process"] },
    { code: "EXP-0205", name: "ค่าธรรมเนียมการขนส่ง", sub: "Transport Fee", cost: "VARIABLE", direct: "DIRECT", req: ["vendor", "costCenter", "process"] },
    { code: "EXP-0301", name: "น้ำมันเชื้อเพลิง", sub: "Fuel", cost: "VARIABLE", direct: null, req: ["vendor", "vehicle", "costCenter", "process"] },
    { code: "EXP-0302", name: "LPG / Gas", sub: "LPG / Gas", cost: "VARIABLE", direct: null, req: ["vendor", "vehicle", "costCenter", "process"] },
    { code: "EXP-0303", name: "น้ำมันเครื่อง", sub: "Engine Oil", cost: "VARIABLE", direct: "DIRECT", req: ["vendor", "vehicle", "costCenter", "process"] },
    { code: "EXP-0304", name: "น้ำมันเกียร์", sub: "Gear Oil", cost: "VARIABLE", direct: "DIRECT", req: ["vendor", "vehicle", "costCenter", "process"] },
    { code: "EXP-0305", name: "น้ำมันเบรก", sub: "Brake Fluid", cost: "VARIABLE", direct: "DIRECT", req: ["vendor", "vehicle", "costCenter", "process"] },
    { code: "EXP-0306", name: "น้ำมันไฮดรอลิค", sub: "Hydraulic Oil", cost: "VARIABLE", direct: "DIRECT", req: ["vendor", "machine", "costCenter", "process"] },
    { code: "EXP-0307", name: "จารบี", sub: "Grease", cost: "VARIABLE", direct: "DIRECT", req: ["vendor", "machine", "costCenter", "process"] },
    { code: "EXP-0401", name: "ค่าน้ำ", sub: "Water", cost: "MIXED", direct: null, req: ["vendor", "location", "costCenter"] },
    { code: "EXP-0402", name: "ค่าไฟฟ้า", sub: "Electricity", cost: "MIXED", direct: null, req: ["vendor", "location", "costCenter"] },
    { code: "EXP-0403", name: "ค่า Internet", sub: "Internet", cost: "FIXED", direct: "INDIRECT", req: ["vendor", "costCenter"] },
    { code: "EXP-0404", name: "ค่าโทรศัพท์", sub: "Telephone", cost: "MIXED", direct: "INDIRECT", req: ["vendor", "costCenter"] },
    { code: "EXP-0501", name: "ค่าเช่าอาคาร / สถานที่", sub: "Building Rent", cost: "FIXED", direct: "INDIRECT", req: ["vendor", "location", "costCenter"] },
    { code: "EXP-0502", name: "ค่าเช่าที่ดิน", sub: "Land Rent", cost: "FIXED", direct: "INDIRECT", req: ["vendor", "location", "costCenter"] },
    { code: "EXP-0601", name: "ค่าอะไหล่", sub: "Spare Parts", cost: "VARIABLE", direct: "DIRECT", req: ["vendor", "machine", "costCenter", "process"] },
    { code: "EXP-0602", name: "ค่าซ่อมรถ", sub: "Vehicle Repair", cost: "VARIABLE", direct: "DIRECT", req: ["vendor", "vehicle", "costCenter", "process"] },
    { code: "EXP-0603", name: "ค่าบำรุงรักษารถ", sub: "Vehicle Maintenance", cost: "MIXED", direct: "DIRECT", req: ["vendor", "vehicle", "costCenter", "process"] },
    { code: "EXP-0604", name: "ค่าบำรุงรักษาเครื่องจักร", sub: "Machine Maintenance", cost: "MIXED", direct: "DIRECT", req: ["vendor", "machine", "costCenter", "process"] },
    { code: "EXP-0701", name: "น้ำดื่ม / น้ำแข็ง", sub: "Drinking Water", cost: "VARIABLE", direct: "INDIRECT", req: ["vendor", "costCenter"] },
    { code: "EXP-0702", name: "ถุง / บรรจุภัณฑ์", sub: "Packaging", cost: "VARIABLE", direct: "DIRECT", req: ["vendor", "costCenter", "process"] },
    { code: "EXP-0703", name: "PPE / อุปกรณ์ความปลอดภัย", sub: "Safety Supplies", cost: "VARIABLE", direct: null, req: ["vendor", "costCenter"] },
    { code: "EXP-0704", name: "วัสดุสิ้นเปลือง", sub: "Consumables", cost: "VARIABLE", direct: null, req: ["vendor", "costCenter"] },
    { code: "EXP-0705", name: "วัสดุสำนักงาน", sub: "Office Supplies", cost: "VARIABLE", direct: "INDIRECT", req: ["vendor", "costCenter"] },
    { code: "EXP-0801", name: "ค่ารักษาพยาบาล", sub: "Medical Expense", cost: "VARIABLE", direct: "INDIRECT", req: ["vendor", "costCenter"] },
    { code: "EXP-0802", name: "ยาและเวชภัณฑ์", sub: "Medical Supplies", cost: "VARIABLE", direct: "INDIRECT", req: ["vendor", "costCenter"] },
    { code: "EXP-0901", name: "ภาษีป้าย", sub: "Signboard Tax", cost: "FIXED", direct: "INDIRECT", req: ["location", "costCenter"] },
    { code: "EXP-0902", name: "ภาษีที่ดินและสิ่งปลูกสร้าง", sub: "Property Tax", cost: "FIXED", direct: "INDIRECT", req: ["location", "costCenter"] },
    { code: "EXP-0903", name: "ค่าธรรมเนียมใบอนุญาต", sub: "License Fee", cost: "FIXED", direct: "INDIRECT", req: ["vendor", "costCenter"] },
    { code: "EXP-0904", name: "ค่าธรรมเนียมราชการ / การขนส่ง", sub: "Government Fee", cost: "MIXED", direct: null, req: ["vendor", "costCenter", "process"] },
    { code: "EXP-0905", name: "ค่าปรับและเบี้ยปรับ", sub: "Penalty", cost: "VARIABLE", direct: "INDIRECT", req: ["costCenter"] },
  ]
  const expenseTypeIdByCode = new Map<string, string>()
  for (const it of expenseItems) {
    const categoryId = categoryIdByCode.get(it.code.slice(4, 6)) ?? null
    const data = {
      name: it.name,
      subcategory: it.sub,
      categoryId,
      defaultCostType: it.cost,
      defaultDirectness: it.direct,
      defaultGlLabel: it.name,
      requiresVendor: it.req.includes("vendor"),
      requiresVehicle: it.req.includes("vehicle"),
      requiresMachine: it.req.includes("machine"),
      requiresLocation: it.req.includes("location"),
      requiresCostCenter: it.req.includes("costCenter"),
      requiresProcess: it.req.includes("process"),
    }
    const r = await prisma.expenseType.upsert({
      where: { companyId_code: { companyId: company.id, code: it.code } },
      update: data,
      create: { companyId: company.id, code: it.code, transactionType: "EXPENSE", isActive: true, ...data },
    })
    expenseTypeIdByCode.set(it.code, r.id)
  }
  console.log(`✅ Expense items created: ${expenseItems.length}`)

  // Explicit allowed/default mappings — only where the spec defines them.
  const ccRows = await prisma.costCenter.findMany({
    where: { companyId: company.id },
    select: { id: true, code: true },
  })
  const costCenterIdByCode = new Map(ccRows.map((r) => [r.code, r.id]))

  const costCenterMappings: { code: string; centers: { cc: string; isDefault?: boolean }[] }[] = [
    { code: "EXP-0301", centers: [{ cc: "TRANSPORT", isDefault: true }, { cc: "PRODUCTION" }, { cc: "WAREHOUSE" }, { cc: "ADMIN" }] },
    { code: "EXP-0201", centers: [{ cc: "TRANSPORT", isDefault: true }] },
    { code: "EXP-0602", centers: [{ cc: "TRANSPORT", isDefault: true }] },
    { code: "EXP-0604", centers: [{ cc: "MAINTENANCE", isDefault: true }, { cc: "PRODUCTION" }] },
    { code: "EXP-0402", centers: [{ cc: "ADMIN", isDefault: true }, { cc: "PRODUCTION" }, { cc: "WAREHOUSE" }] },
  ]
  for (const m of costCenterMappings) {
    const etId = expenseTypeIdByCode.get(m.code)
    if (!etId) continue
    for (const c of m.centers) {
      const ccId = costCenterIdByCode.get(c.cc)
      if (!ccId) continue
      await prisma.expenseTypeCostCenter.upsert({
        where: { expenseTypeId_costCenterId: { expenseTypeId: etId, costCenterId: ccId } },
        update: { isDefault: c.isDefault ?? false, isAllowed: true },
        create: { companyId: company.id, expenseTypeId: etId, costCenterId: ccId, isDefault: c.isDefault ?? false, isAllowed: true },
      })
    }
  }

  const processMappings: { code: string; procs: { p: string; isDefault?: boolean }[] }[] = [
    { code: "EXP-0301", procs: [{ p: "PROC-COLLECTION", isDefault: true }, { p: "PROC-DELIVERY" }, { p: "PROC-ADMIN" }] },
    { code: "EXP-0201", procs: [{ p: "PROC-DELIVERY", isDefault: true }, { p: "PROC-COLLECTION" }] },
    { code: "EXP-0602", procs: [{ p: "PROC-VEHICLE-MAINTENANCE", isDefault: true }] },
    { code: "EXP-0604", procs: [{ p: "PROC-MACHINE-MAINTENANCE", isDefault: true }] },
    { code: "EXP-0402", procs: [{ p: "PROC-ADMIN", isDefault: true }, { p: "PROC-WAREHOUSE" }] },
  ]
  for (const m of processMappings) {
    const etId = expenseTypeIdByCode.get(m.code)
    if (!etId) continue
    for (const pr of m.procs) {
      const pId = processIdByCode.get(pr.p)
      if (!pId) continue
      await prisma.expenseTypeProcess.upsert({
        where: { expenseTypeId_processId: { expenseTypeId: etId, processId: pId } },
        update: { isDefault: pr.isDefault ?? false, isAllowed: true },
        create: { companyId: company.id, expenseTypeId: etId, processId: pId, isDefault: pr.isDefault ?? false, isAllowed: true },
      })
    }
  }
  console.log("✅ Expense master mappings created")

  console.log("\n🎉 Seed completed successfully!")
  console.log("─────────────────────────────────────")
  console.log("👤 Admin username : admin")
  console.log("📧 Admin email    : admin@demo.com")
  console.log("🔑 Admin password : Admin@1234")
  console.log("👤 Test username  : test")
  console.log("📧 Test email     : test@demo.com")
  console.log("🔑 Test password  : Test@1234")
  console.log("─────────────────────────────────────")
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
