import { prisma } from "@/lib/prisma"

export type CompanyBrand = {
  logoUrl: string | null
  name: string
}

/** อ่านโลโก้/ชื่อบริษัทตาม companyId (หลังล็อกอิน) */
export async function getCompanyBrand(companyId: string): Promise<CompanyBrand | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { logoUrl: true, name: true },
  })
  if (!company) return null
  return { logoUrl: company.logoUrl, name: company.name }
}

/** อ่านแบรนด์บริษัทแรกในระบบ (หน้า Login / pre-auth) */
export async function getDefaultCompanyBrand(): Promise<CompanyBrand | null> {
  const company = await prisma.company.findFirst({
    orderBy: { createdAt: "asc" },
    select: { logoUrl: true, name: true },
  })
  if (!company) return null
  return { logoUrl: company.logoUrl, name: company.name }
}
