import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Edit, Calendar, Wrench, ClipboardList, Package } from "lucide-react"
import { ClickableImage } from "@/components/ui/clickable-image"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { MachineStatusBadge } from "@/components/machines/machine-status-badge"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import { hasPermission, type UserRole } from "@/lib/permissions"
import { MachineSparePartsCard } from "@/components/machines/machine-spare-parts-card"

export const metadata: Metadata = { title: "รายละเอียดเครื่องจักร" }

const criticalLabels = ["", "ต่ำ", "ปานกลาง", "สูง", "วิกฤต"]
const criticalColors = ["", "bg-green-50 text-green-700 border-green-200", "bg-yellow-50 text-yellow-700 border-yellow-200", "bg-orange-50 text-orange-700 border-orange-200", "bg-red-50 text-red-700 border-red-200"]

async function getMachine(id: string, companyId: string) {
  const machine = await prisma.machine.findFirst({
    where: { id, branch: { companyId }, deletedAt: null },
    include: {
      branch: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      images: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      maintenancePlans: {
        where: { isActive: true },
        include: { type: { select: { name: true, code: true, color: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      workOrders: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          type: { select: { name: true, code: true, color: true } },
          assignee: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })
  if (!machine) return null

  const [rawProducts, extra] = await Promise.all([
    prisma.$queryRaw<any[]>`
      SELECT * FROM machine_products WHERE machine_id = ${id}::uuid ORDER BY "order" ASC
    `,
    prisma.$queryRaw<{ machine_type: string | null; description: string | null; pm_general: string | null; pm_major: string | null }[]>`
      SELECT machine_type, description, pm_general, pm_major FROM machines WHERE id = ${id}::uuid LIMIT 1
    `,
  ])

  const products = rawProducts.map((r) => ({
    id: r.id, name: r.name, description: r.description,
    imageUrl: r.image_url, order: r.order,
  }))

  return {
    ...machine,
    machineType: extra[0]?.machine_type ?? null,
    description: extra[0]?.description ?? null,
    pmGeneral: extra[0]?.pm_general ?? null,
    pmMajor: extra[0]?.pm_major ?? null,
    products,
  } as any
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-400 text-sm w-40 shrink-0">{label}</span>
      <span className="text-slate-800 text-sm font-medium">{value ?? "—"}</span>
    </div>
  )
}

export default async function MachineDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await auth()
  const machine = await getMachine(params.id, session!.user.companyId as string)
  if (!machine) notFound()

  const canEditMachineBom = hasPermission(
    session!.user.roles as UserRole[],
    machine.branchId,
    "machines",
    "update"
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/machines" className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-800">{machine.name}</h1>
              <MachineStatusBadge status={machine.status} />
              {machine.criticalLevel >= 3 && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${criticalColors[machine.criticalLevel]}`}>
                  ความเสี่ยง: {criticalLabels[machine.criticalLevel]}
                </span>
              )}
            </div>
            <p className="text-slate-500 text-sm mt-0.5">
              รหัส: {machine.code} · {machine.category.name} · {machine.branch.name}
            </p>
          </div>
        </div>
        <Link
          href={`/machines/${machine.id}/edit`}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Edit className="w-4 h-4" />
          แก้ไขข้อมูล
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Images */}
          {(machine as any).images?.length > 0 && (
            <Card>
              <CardHeader><CardTitle>รูปภาพเครื่องจักร</CardTitle></CardHeader>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {(machine as any).images.map((img: any) => (
                  <div key={img.id} className={`relative aspect-square rounded-lg overflow-hidden border-2 hover:border-blue-400 transition-colors ${img.isPrimary ? "border-blue-400" : "border-slate-200"}`}>
                    <ClickableImage src={img.fileUrl} alt={img.fileName || "Machine image"} fill sizes="(max-width: 768px) 33vw, 20vw" className="object-cover hover:scale-105 transition-transform" />
                    {img.isPrimary && (
                      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full pointer-events-none z-10">หลัก</div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>ข้อมูลทั่วไป</CardTitle></CardHeader>
            <InfoRow label="รหัสเครื่องจักร" value={machine.code} />
            <InfoRow label="ชื่อเครื่องจักร" value={machine.name} />
            <InfoRow label="ประเภท" value={(machine as any).machineType} />
            <InfoRow label="รุ่น (Model)" value={machine.model} />
            <InfoRow label="ผู้ผลิต" value={machine.manufacturer} />
            <InfoRow label="หมายเลขซีเรียล" value={machine.serialNumber} />
            <InfoRow label="สาขา" value={machine.branch.name} />
            <InfoRow label="แผนก" value={machine.department?.name} />
            <InfoRow label="หมวดหมู่" value={machine.category.name} />
            <InfoRow label="ตำแหน่ง" value={machine.locationDetail} />
            {(machine as any).description && (
              <div className="py-2.5 border-b border-slate-100">
                <span className="text-slate-400 text-sm block mb-1">รายละเอียด</span>
                <p className="text-slate-800 text-sm whitespace-pre-wrap">{(machine as any).description}</p>
              </div>
            )}
          </Card>

          <MachineSparePartsCard machineId={machine.id} canEdit={canEditMachineBom} />

          {((machine as any).pmGeneral || (machine as any).pmMajor) && (
            <Card>
              <CardHeader><CardTitle>ขอบเขตการซ่อมบำรุง (Scope of Work)</CardTitle></CardHeader>
              <div className="space-y-5">
                {(machine as any).pmGeneral && (
                  <div>
                    <p className="text-slate-600 font-medium text-sm mb-2 pb-1 border-b flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">PM ทั่วไป</span>
                      General PM
                    </p>
                    <pre className="text-slate-700 text-sm whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 p-4 rounded-lg border">{(machine as any).pmGeneral}</pre>
                  </div>
                )}
                {(machine as any).pmMajor && (
                  <div>
                    <p className="text-slate-600 font-medium text-sm mb-2 pb-1 border-b flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">PM ใหญ่</span>
                      Major PM
                    </p>
                    <pre className="text-slate-700 text-sm whitespace-pre-wrap font-sans leading-relaxed bg-slate-50 p-4 rounded-lg border">{(machine as any).pmMajor}</pre>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>วันที่สำคัญ</CardTitle></CardHeader>
            <InfoRow label="วันที่ติดตั้ง" value={machine.installDate ? formatDate(machine.installDate) : undefined} />
            <InfoRow label="วันหมดประกัน" value={machine.warrantyExpireDate ? formatDate(machine.warrantyExpireDate) : undefined} />
            <InfoRow label="วันที่เพิ่มข้อมูล" value={formatDate(machine.createdAt)} />
            <InfoRow label="แก้ไขล่าสุด" value={formatDate(machine.updatedAt)} />
          </Card>

          {/* Products */}
          {(machine as any).products?.length > 0 && (
            <Card>
              <CardHeader><CardTitle>รายการสินค้า / ผลิตภัณฑ์</CardTitle></CardHeader>
              <div className="space-y-3">
                {(machine as any).products.map((product: any) => (
                  <div key={product.id} className="flex gap-3 p-3 bg-slate-50 rounded-lg">
                    {product.imageUrl && (
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 shrink-0 hover:border-blue-400 transition-colors">
                        <ClickableImage src={product.imageUrl} alt={product.name} fill sizes="64px" className="object-cover hover:scale-105 transition-transform" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{product.name}</p>
                      {product.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{product.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

        </div>

        {/* Right: Stats + Plans */}
        <div className="space-y-5">
          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "แผนซ่อมบำรุง", value: machine.maintenancePlans.length, icon: Calendar, color: "bg-blue-500" },
              { label: "ใบสั่งงาน", value: machine.workOrders.length, icon: ClipboardList, color: "bg-amber-500" },
            ].map((stat) => (
              <Card key={stat.label} padding="sm">
                <div className={`w-9 h-9 ${stat.color} rounded-lg flex items-center justify-center mb-2`}>
                  <stat.icon className="w-4 h-4 text-white" />
                </div>
                <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
              </Card>
            ))}
          </div>

          {/* Active Maintenance Plans */}
          <Card>
            <CardHeader>
              <CardTitle>แผนซ่อมบำรุงที่ใช้งาน</CardTitle>
              <Link href={`/maintenance/plans?machineId=${machine.id}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                จัดการ →
              </Link>
            </CardHeader>
            {machine.maintenancePlans.length === 0 ? (
              <div className="text-center py-6">
                <Wrench className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">ยังไม่มีแผนซ่อมบำรุง</p>
                <Link
                  href={`/maintenance/plans/new?machineId=${machine.id}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-blue-600 text-sm hover:text-blue-800"
                >
                  <Package className="w-3.5 h-3.5" /> สร้างแผนใหม่
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {machine.maintenancePlans.map((plan: NonNullable<typeof machine>["maintenancePlans"][number]) => (
                  <div key={plan.id} className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm font-medium text-slate-800">{plan.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: `${plan.type.color ?? "#6b7280"}18`, color: plan.type.color ?? "#6b7280" }}
                      >
                        {plan.type.code}
                      </span>
                      <span className="text-xs text-slate-400">
                        ทุก {plan.frequencyValue} {plan.frequencyUnit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent Work Orders */}
          <Card>
            <CardHeader>
              <CardTitle>ใบสั่งงานล่าสุด</CardTitle>
              <Link href={`/work-orders?machineId=${machine.id}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                ดูทั้งหมด →
              </Link>
            </CardHeader>
            {machine.workOrders.length === 0 ? (
              <p className="text-slate-400 text-sm py-4 text-center">ยังไม่มีใบสั่งงาน</p>
            ) : (
              <div className="space-y-2">
                {machine.workOrders.map((wo: NonNullable<typeof machine>["workOrders"][number]) => (
                  <div key={wo.id} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="pr-4">
                        <p className="text-sm font-medium text-slate-800">{wo.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {wo.woNumber} · {wo.assignee ? `${wo.assignee.firstName} ${wo.assignee.lastName}` : "ยังไม่มอบหมาย"}
                        </p>
                      </div>
                      <Badge variant={
                        wo.status === "completed" ? "success" :
                        wo.status === "in_progress" ? "info" :
                        wo.status === "open" ? "warning" : "default"
                      } className="whitespace-nowrap">
                        {wo.status === "completed" ? "เสร็จสิ้น" :
                         wo.status === "in_progress" ? "กำลังดำเนินการ" :
                         wo.status === "open" ? "เปิด" : wo.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border"
                        style={{ backgroundColor: `${wo.type.color ?? "#6b7280"}18`, color: wo.type.color ?? "#6b7280", borderColor: `${wo.type.color ?? "#6b7280"}40` }}
                      >
                        {wo.type.code}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
