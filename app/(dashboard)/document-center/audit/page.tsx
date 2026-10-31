import { ScrollText } from "lucide-react"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/permissions"
import { prisma } from "@/shared/db"
import { AppDataTable, AppDataTableBody, AppDataTableHead, AppDataTablePanel } from "@/components/shell/app-data-table"
import { ListFrame } from "@/components/shell/list-frame"
import { EmptyState } from "@/components/ui/empty-state"
import { ListPagination, SSR_PAGE_SIZE, parsePage } from "@/components/ui/list-pagination"
import { canDocuments, listAccessLogs } from "@/modules/document_center"

export default async function DocumentAuditPage(props: { searchParams: Promise<{ page?: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canDocuments(roles, "approve")) redirect("/document-center")
  const sp = await props.searchParams
  const t = await getTranslations("documentCenter")
  const result = await listAccessLogs(prisma, {
    companyId: session.user.companyId as string,
    roles,
    page: parsePage(sp.page),
    pageSize: SSR_PAGE_SIZE,
  })
  return (
    <ListFrame title={t("auditTitle")} description={t("auditDesc")} plainPanel>
      <AppDataTablePanel>
        {result.data.length === 0 ? (
          <EmptyState icon={ScrollText} title={t("auditEmpty")} />
        ) : (
          <AppDataTable>
            <AppDataTableHead>
              <tr>
                <th>{t("auditWhen")}</th>
                <th>{t("auditWho")}</th>
                <th>{t("auditAction")}</th>
                <th>{t("colName")}</th>
                <th className="hidden xl:table-cell">{t("colVersion")}</th>
              </tr>
            </AppDataTableHead>
            <AppDataTableBody>
              {result.data.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">{new Date(row.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">{row.userName}</td>
                  <td className="px-4 py-3">{row.action === "VIEW" ? t("auditView") : t("auditDownload")}</td>
                  <td className="px-4 py-3">{row.documentCode} · {row.documentName}</td>
                  <td className="hidden px-4 py-3 xl:table-cell">{row.versionNumber ?? ""}</td>
                </tr>
              ))}
            </AppDataTableBody>
          </AppDataTable>
        )}
        <ListPagination pathname="/document-center/audit" page={result.page} totalPages={Math.max(1, Math.ceil(result.total / result.pageSize))} total={result.total} />
      </AppDataTablePanel>
    </ListFrame>
  )
}
