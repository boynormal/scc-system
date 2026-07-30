import Link from "next/link"

type Props = {
  pathname: string
  page: number
  totalPages: number
  total: number
  /** query อื่นที่ต้องคงไว้ (ไม่รวม page) */
  query?: Record<string, string | undefined>
}

function buildHref(pathname: string, query: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value)
  }
  if (page > 1) params.set("page", String(page))
  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

/** ลิงก์ก่อน/ถัดไปแบบเบาสำหรับหน้า SSR list */
export function ListPagination({ pathname, page, totalPages, total, query = {} }: Props) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border text-sm text-muted-foreground">
      <span>
        หน้า {page} / {totalPages} · ทั้งหมด {total} รายการ
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={buildHref(pathname, query, page - 1)}
            className="px-3 py-1.5 border border-border rounded-lg hover:bg-muted/60"
          >
            ก่อนหน้า
          </Link>
        ) : (
          <span className="px-3 py-1.5 border border-border rounded-lg opacity-40">ก่อนหน้า</span>
        )}
        {page < totalPages ? (
          <Link
            href={buildHref(pathname, query, page + 1)}
            className="px-3 py-1.5 border border-border rounded-lg hover:bg-muted/60"
          >
            ถัดไป
          </Link>
        ) : (
          <span className="px-3 py-1.5 border border-border rounded-lg opacity-40">ถัดไป</span>
        )}
      </div>
    </div>
  )
}

export const SSR_PAGE_SIZE = 50

export function parsePage(raw: string | undefined): number {
  const n = parseInt(raw ?? "1", 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}
