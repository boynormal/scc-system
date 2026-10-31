import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { prisma } from "@/shared/db"
import { ListFrame } from "@/components/shell/list-frame"
import { DocMasterManager } from "@/components/document-center/doc-master-manager"
import { canDocumentMasters, listCategories, listTypes } from "@/modules/document_center"

export default async function DocumentMasterPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canDocumentMasters(roles, "read")) redirect("/document-center")
  const t = await getTranslations("documentCenter")
  const companyId = session.user.companyId as string
  const [categories, types] = await Promise.all([
    listCategories(prisma, { companyId, roles }),
    listTypes(prisma, { companyId, roles }),
  ])
  return (
    <ListFrame title={t("mastersTitle")} description={t("mastersDesc")} plainPanel>
      <DocMasterManager
        categories={categories.data}
        types={types.data}
        canCreate={canDocumentMasters(roles, "create")}
        canUpdate={canDocumentMasters(roles, "update")}
        canDelete={canDocumentMasters(roles, "delete")}
      />
    </ListFrame>
  )
}
