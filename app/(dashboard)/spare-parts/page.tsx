import { Metadata } from "next"
import { Package, Plus, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { SparePartListThumbnail } from "@/components/spare-parts/spare-part-list-thumbnail"
import { ListPagination, SSR_PAGE_SIZE, parsePage } from "@/components/ui/list-pagination"

export const metadata: Metadata = { title: "อะไหล่" }

async function getSparePartsPage(
  companyId: string,
  page: number,
  search?: string,
  lowStock?: boolean
) {
  const skip = (page - 1) * SSR_PAGE_SIZE
  const searchPattern = search?.trim() ? `%${search.trim()}%` : null

  let ids: string[]
  let total: number
  let totalLowStock: number

  if (lowStock) {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT sp.id
      FROM spare_parts sp
      WHERE sp.company_id = ${companyId}::uuid
        AND sp.is_active = true
        AND EXISTS (
          SELECT 1 FROM spare_part_inventory spi
          WHERE spi.part_id = sp.id AND spi.current_stock <= sp.min_stock
        )
        AND (
          ${searchPattern}::text IS NULL
          OR sp.name ILIKE ${searchPattern}
          OR sp.code ILIKE ${searchPattern}
        )
      ORDER BY sp.name ASC
      LIMIT ${SSR_PAGE_SIZE} OFFSET ${skip}
    `
    ids = rows.map((r) => r.id)

    const [countRow, lowCountRow] = await Promise.all([
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM spare_parts sp
        WHERE sp.company_id = ${companyId}::uuid
          AND sp.is_active = true
          AND EXISTS (
            SELECT 1 FROM spare_part_inventory spi
            WHERE spi.part_id = sp.id AND spi.current_stock <= sp.min_stock
          )
          AND (
            ${searchPattern}::text IS NULL
            OR sp.name ILIKE ${searchPattern}
            OR sp.code ILIKE ${searchPattern}
          )
      `,
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM spare_parts sp
        WHERE sp.company_id = ${companyId}::uuid
          AND sp.is_active = true
          AND EXISTS (
            SELECT 1 FROM spare_part_inventory spi
            WHERE spi.part_id = sp.id AND spi.current_stock <= sp.min_stock
          )
      `,
    ])
    total = Number(countRow[0]?.count ?? 0)
    totalLowStock = Number(lowCountRow[0]?.count ?? 0)
  } else {
    const where: Prisma.SparePartWhereInput = {
      companyId,
      isActive: true,
      ...(search?.trim() && {
        OR: [
          { name: { contains: search.trim(), mode: "insensitive" } },
          { code: { contains: search.trim(), mode: "insensitive" } },
        ],
      }),
    }

    const [partsPage, count, lowCountRow] = await Promise.all([
      prisma.sparePart.findMany({
        where,
        select: { id: true },
        orderBy: { name: "asc" },
        skip,
        take: SSR_PAGE_SIZE,
      }),
      prisma.sparePart.count({ where }),
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM spare_parts sp
        WHERE sp.company_id = ${companyId}::uuid
          AND sp.is_active = true
          AND EXISTS (
            SELECT 1 FROM spare_part_inventory spi
            WHERE spi.part_id = sp.id AND spi.current_stock <= sp.min_stock
          )
      `,
    ])
    ids = partsPage.map((p) => p.id)
    total = count
    totalLowStock = Number(lowCountRow[0]?.count ?? 0)
  }

  if (ids.length === 0) {
    return { parts: [], total, totalLowStock }
  }

  const parts = await prisma.sparePart.findMany({
    where: { id: { in: ids } },
    include: {
      supplier: { select: { id: true, name: true } },
      inventory: true,
    },
  })

  const order = new Map(ids.map((id, i) => [id, i]))
  parts.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))

  return { parts, total, totalLowStock }
}

export default async function SparePartsPage(
  props: {
    searchParams: Promise<{ search?: string; lowStock?: string; page?: string }>
  }
) {
  const searchParams = await props.searchParams
  const page = parsePage(searchParams.page)
  const session = await auth()
  const companyId = session!.user.companyId as string
  const lowStock = searchParams.lowStock === "1"
  const { parts, total, totalLowStock } = await getSparePartsPage(
    companyId,
    page,
    searchParams.search,
    lowStock
  )
  const totalPages = Math.max(1, Math.ceil(total / SSR_PAGE_SIZE))
  const paginationQuery = {
    search: searchParams.search,
    lowStock: lowStock ? "1" : undefined,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">อะไหล่ (Spare Parts)</h1>
          <p className="text-muted-foreground text-sm mt-1">
            ทั้งหมด {total} รายการ
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

      <div className="flex gap-3 flex-wrap">
        <form method="get" className="flex gap-2 flex-1 min-w-0">
          {lowStock && <input type="hidden" name="lowStock" value="1" />}
          <input
            name="search"
            defaultValue={searchParams.search}
            placeholder="ค้นหาชื่อ / รหัสอะไหล่..."
            className="flex-1 min-w-0 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700">ค้นหา</button>
        </form>
        <Link
          href={lowStock
            ? (searchParams.search ? `/spare-parts?search=${encodeURIComponent(searchParams.search)}` : "/spare-parts")
            : (searchParams.search ? `/spare-parts?lowStock=1&search=${encodeURIComponent(searchParams.search)}` : "/spare-parts?lowStock=1")}
          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
            lowStock
              ? "bg-orange-100 text-orange-700 border-orange-200"
              : "border-border text-muted-foreground hover:bg-muted/60"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          ใกล้หมดเท่านั้น
        </Link>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {parts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Package className="w-12 h-12 mb-3 opacity-20" />
            <p className="font-medium">ไม่มีอะไหล่</p>
            <Link href="/spare-parts/new" className="mt-3 text-sm text-blue-600 hover:underline flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> เพิ่มอะไหล่แรก
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    {["รหัส / ชื่อ", "ซัพพลายเออร์", "หน่วย", "ราคาต่อหน่วย", "สต็อก", "Min Stock", "สถานะ", ""].map(h => (
                      <th key={h} className="px-5 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parts.map(part => {
                    const totalStock = part.inventory.reduce((sum, inv) => sum + inv.currentStock, 0)
                    const isLow = totalStock <= part.minStock
                    return (
                      <tr key={part.id} className={`hover:bg-muted/60 transition-colors ${isLow ? "bg-orange-50/30" : ""}`}>
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
                              <p className="font-medium text-foreground">{part.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{part.code}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">{part.supplier?.name ?? <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-5 py-3.5 text-muted-foreground">{part.unit}</td>
                        <td className="px-5 py-3.5 text-muted-foreground">
                          ฿{Number(part.unitCost).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`font-semibold ${isLow ? "text-orange-600" : "text-foreground"}`}>
                            {totalStock}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">{part.minStock}</td>
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
            <ListPagination
              pathname="/spare-parts"
              page={page}
              totalPages={totalPages}
              total={total}
              query={paginationQuery}
            />
          </>
        )}
      </div>
    </div>
  )
}
