import { Metadata } from "next"
import { Package, Plus, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { SparePartListThumbnail } from "@/components/spare-parts/spare-part-list-thumbnail"

export const metadata: Metadata = { title: "อะไหล่" }

async function getSpareParts(companyId: string, search?: string, lowStock?: boolean) {
  const parts = await prisma.sparePart.findMany({
    where: {
      companyId,
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      supplier: { select: { id: true, name: true } },
      inventory: true,
    },
    orderBy: { name: "asc" },
  })
  if (lowStock) return parts.filter(p => p.inventory.some(inv => inv.currentStock <= p.minStock))
  return parts
}

export default async function SparePartsPage(
  props: {
    searchParams: Promise<{ search?: string; lowStock?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const session = await auth()
  const companyId = session!.user.companyId as string
  const parts = await getSpareParts(companyId, searchParams.search, searchParams.lowStock === "1")
  const totalLowStock = parts.filter(p => p.inventory.some(inv => inv.currentStock <= p.minStock)).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">อะไหล่ (Spare Parts)</h1>
          <p className="text-slate-500 text-sm mt-1">
            ทั้งหมด {parts.length} รายการ
            {totalLowStock > 0 && (
              <span className="ml-2 text-orange-600 font-medium">· ใกล้หมด {totalLowStock} รายการ</span>
            )}
          </p>
        </div>
        <Link
          href="/spare-parts/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          เพิ่มอะไหล่
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <form method="get" className="flex gap-2 flex-1 min-w-0">
          <input
            name="search"
            defaultValue={searchParams.search}
            placeholder="ค้นหาชื่อ / รหัสอะไหล่..."
            className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700">ค้นหา</button>
        </form>
        <Link
          href={searchParams.lowStock === "1" ? "/spare-parts" : "/spare-parts?lowStock=1"}
          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
            searchParams.lowStock === "1"
              ? "bg-orange-100 text-orange-700 border-orange-200"
              : "border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          ใกล้หมดเท่านั้น
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {parts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Package className="w-12 h-12 mb-3 opacity-20" />
            <p className="font-medium">ไม่มีอะไหล่</p>
            <Link href="/spare-parts/new" className="mt-3 text-sm text-blue-600 hover:underline flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> เพิ่มอะไหล่แรก
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["รหัส / ชื่อ", "ซัพพลายเออร์", "หน่วย", "ราคาต่อหน่วย", "สต็อก", "Min Stock", "สถานะ", ""].map(h => (
                    <th key={h} className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parts.map(part => {
                  const totalStock = part.inventory.reduce((sum, inv) => sum + inv.currentStock, 0)
                  const isLow = totalStock <= part.minStock
                  return (
                    <tr key={part.id} className={`hover:bg-slate-50 transition-colors ${isLow ? "bg-orange-50/30" : ""}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`shrink-0 rounded-lg ${
                              part.imageUrl?.trim() && isLow ? "ring-2 ring-orange-300 ring-offset-0" : ""
                            }`}
                          >
                            <SparePartListThumbnail
                              imageUrl={part.imageUrl}
                              name={part.name}
                              isLowStock={isLow}
                            />
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{part.name}</p>
                            <p className="text-xs text-slate-400 font-mono">{part.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">{part.supplier?.name ?? <span className="text-slate-400">—</span>}</td>
                      <td className="px-5 py-3.5 text-slate-600">{part.unit}</td>
                      <td className="px-5 py-3.5 text-slate-600">
                        ฿{Number(part.unitCost).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`font-semibold ${isLow ? "text-orange-600" : "text-slate-800"}`}>
                          {totalStock}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{part.minStock}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          totalStock <= 0
                            ? "bg-red-100 text-red-700"
                            : isLow
                            ? "bg-orange-100 text-orange-700"
                            : "bg-green-100 text-green-700"
                        }`}>
                          {totalStock <= 0 ? "หมด" : isLow ? "ใกล้หมด" : "ปกติ"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/spare-parts/${part.id}/edit`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          แก้ไข
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
