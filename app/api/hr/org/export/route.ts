import * as XLSX from "xlsx"
import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { getPersonnelOrgChart, type OrgChartNode } from "@/modules/hr"

type Row = {
  ชั้น: number
  ตำแหน่ง: string
  รหัสตำแหน่ง: string
  หัวหน้า: string
  แผนก: string
  ชื่อผู้ดำรงตำแหน่ง: string
  รหัสรายชื่อ: string
  อัตรากำลัง: number | string
  ว่าง: number | string
  หน้าที่ความรับผิดชอบ: string
}

/** หนึ่งแถวต่อคน และตำแหน่งว่างได้หนึ่งแถวเปล่า เพื่อให้กรองใน Excel ได้ตรง */
function toRows(nodes: OrgChartNode[], parentName: string, out: Row[]): void {
  for (const node of nodes) {
    const base = {
      ชั้น: node.depth + 1,
      ตำแหน่ง: node.name,
      รหัสตำแหน่ง: node.code ?? "",
      หัวหน้า: parentName,
      แผนก: node.department?.name ?? "",
      อัตรากำลัง: node.headcount,
      ว่าง: node.vacancy,
      หน้าที่ความรับผิดชอบ: node.responsibilities.join("\n"),
    }

    if (node.occupants.length === 0) {
      out.push({ ...base, ชื่อผู้ดำรงตำแหน่ง: "", รหัสรายชื่อ: "" })
    } else {
      node.occupants.forEach((occupant, index) => {
        out.push({
          ...base,
          // ตัวเลขซ้ำทุกแถวจะทำให้ยอดรวมใน Excel เพี้ยน — ใส่แค่แถวแรกของตำแหน่ง
          อัตรากำลัง: index === 0 ? node.headcount : "",
          ว่าง: index === 0 ? node.vacancy : "",
          ชื่อผู้ดำรงตำแหน่ง: occupant.displayName + (occupant.isActive ? "" : " (ปิดใช้งาน)"),
          รหัสรายชื่อ: occupant.rosterNo,
        })
      })
    }

    toRows(node.children, node.name, out)
  }
}

function parseIsActive(raw: string | null): boolean | null {
  if (raw === "false") return false
  if (raw === "all") return null
  return true
}

export const GET = withAuth(async (req, _ctx, session) => {
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "hr_personnel", "read")
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId")
  if (!branchId) throw new ValidationError("กรุณาเลือกสาขา")

  const { data: chart } = await getPersonnelOrgChart(prisma, {
    companyId: session.user.companyId as string,
    roles,
    branchId,
    isActive: parseIsActive(searchParams.get("isActive")),
  })

  const rows: Row[] = []
  toRows(chart.roots, "", rows)
  for (const occupant of chart.unplaced) {
    rows.push({
      ชั้น: 0,
      ตำแหน่ง: "(ยังไม่จัดตำแหน่ง)",
      รหัสตำแหน่ง: "",
      หัวหน้า: "",
      แผนก: "",
      ชื่อผู้ดำรงตำแหน่ง: occupant.displayName,
      รหัสรายชื่อ: occupant.rosterNo,
      อัตรากำลัง: "",
      ว่าง: "",
      หน้าที่ความรับผิดชอบ: "",
    })
  }

  const sheet = XLSX.utils.json_to_sheet(rows)
  sheet["!cols"] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 12 },
    { wch: 24 },
    { wch: 18 },
    { wch: 24 },
    { wch: 12 },
    { wch: 10 },
    { wch: 8 },
    { wch: 60 },
  ]
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, "ผังองค์กร")
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer

  const stamp = new Date().toISOString().slice(0, 10)
  const fileName = `org-chart-${chart.branch.code}-${stamp}.xlsx`

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  })
})
