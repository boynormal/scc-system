import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { canManageHrPositions } from "@/lib/hr-settings-nav-access"
import { canEditDutyCatalog, listDutyCatalog } from "@/modules/hr"
import { DutyCatalogManager } from "./duty-catalog-manager"

export const metadata: Metadata = { title: "สมุดหน้าที่" }

export default async function HrDutiesPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canManageHrPositions(roles)) redirect("/hr/personnel")

  const { data } = await listDutyCatalog(prisma, {
    companyId: session.user.companyId as string,
    roles,
    includeInactive: true,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">สมุดหน้าที่</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          หมวดและรายการหน้าที่ใช้ร่วมทุกสาขา ตำแหน่งติ๊กเป็นชุดตั้งต้น แต่ละคนติ๊กรายการที่ตัวเองดูแลจริง
        </p>
      </div>
      <DutyCatalogManager categories={data} canEdit={canEditDutyCatalog(roles)} />
    </div>
  )
}
