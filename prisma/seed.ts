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
    update: { passwordHash: adminPasswordHash, deletedAt: null, isActive: true },
    create: {
      companyId: company.id,
      employeeCode: "EMP001",
      email: "admin@demo.com",
      passwordHash: adminPasswordHash,
      firstName: "System",
      lastName: "Admin",
      isActive: true,
    },
  })
  console.log("✅ Admin user:", adminUser.email)

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
    update: { passwordHash: testPasswordHash, deletedAt: null, isActive: true },
    create: {
      companyId: company.id,
      employeeCode: "EMP002",
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
    where: { code: "MCH-001" },
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
  const supplier = await prisma.supplier.create({
    data: {
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

  const part = await prisma.sparePart.create({
    data: {
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

  await prisma.sparePartInventory.create({
    data: {
      partId: part.id,
      branchId: branch.id,
      currentStock: 20,
      reservedStock: 0,
    },
  })
  console.log("✅ Sample spare part + inventory created")

  console.log("\n🎉 Seed completed successfully!")
  console.log("─────────────────────────────────────")
  console.log("📧 Admin email    : admin@demo.com")
  console.log("🔑 Admin password : Admin@1234")
  console.log("📧 Test email      : test@demo.com")
  console.log("🔑 Test password   : Test@1234")
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
