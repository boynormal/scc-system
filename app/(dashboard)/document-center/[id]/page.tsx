import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { NotFoundError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { prisma } from "@/shared/db"
import { DataPanel } from "@/components/shell/data-panel"
import { PageHeader } from "@/components/shell/page-header"
import { DocAcknowledgeButton } from "@/components/document-center/doc-acknowledge-button"
import { DocDetailActions } from "@/components/document-center/doc-detail-actions"
import { DocFavoriteButton } from "@/components/document-center/doc-favorite-button"
import { DocFileIcon } from "@/components/document-center/doc-file-icon"
import {
  canDocuments,
  canPreviewKind,
  documentFilePath,
  getDocument,
  listCategories,
  listDocumentAcknowledgements,
  listTypes,
} from "@/modules/document_center"

export default async function DocumentDetailPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canDocuments(roles, "read")) redirect("/")
  const { id } = await props.params
  const t = await getTranslations("documentCenter")
  const scope = { companyId: session.user.companyId as string, roles, userId: session.user.id as string }
  let detail: Awaited<ReturnType<typeof getDocument>>
  try {
    detail = await getDocument(prisma, { ...scope, id })
  } catch (err) {
    if (err instanceof NotFoundError) notFound()
    throw err
  }
  const [categories, types] = await Promise.all([
    listCategories(prisma, { companyId: scope.companyId, roles, activeOnly: true }),
    listTypes(prisma, { companyId: scope.companyId, roles, activeOnly: true }),
  ])
  const item = detail.data
  const canApprove = canDocuments(roles, "approve")
  const roster = canApprove ? await listDocumentAcknowledgements(prisma, { ...scope, id }) : null
  const preview = item.versionId && canPreviewKind(item.fileKind) ? documentFilePath(item.id, item.versionId, "inline") : null
  const download = item.versionId ? documentFilePath(item.id, item.versionId, "attachment") : null

  return (
    <div className="space-y-4">
      <Link href="/document-center" className="text-sm text-foreground underline">{t("backToLibrary")}</Link>
      <PageHeader
        title={item.documentName}
        description={item.documentCode}
        actions={
          <div className="flex items-center gap-2">
            <DocFavoriteButton id={item.id} favorite={item.favorite} addLabel={t("favoriteAdd")} removeLabel={t("favoriteRemove")} />
            {download ? <a className="text-sm text-foreground underline" href={download}>{t("download")}</a> : null}
          </div>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <DataPanel padding="md">
          {preview && item.fileKind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={item.documentName} className="max-h-[36rem] w-full object-contain" />
          ) : preview ? (
            <iframe title={item.documentName} src={preview} className="h-[36rem] w-full rounded-lg border border-border bg-white" />
          ) : (
            <div className="flex flex-col items-center gap-3 py-10 text-center text-foreground">
              <DocFileIcon kind={item.fileKind} />
              <p className="font-medium">{t("previewUnsupported")}</p>
              <p className="text-sm">{t("previewUnsupportedDesc")}</p>
            </div>
          )}
        </DataPanel>
        <DataPanel padding="md">
          <dl className="mb-4 space-y-2 text-sm text-foreground">
            <div><dt className="font-medium">{t("category")}</dt><dd>{item.categoryName}</dd></div>
            <div><dt className="font-medium">{t("type")}</dt><dd>{item.typeName}</dd></div>
            <div><dt className="font-medium">{t("description")}</dt><dd>{item.description || "-"}</dd></div>
          </dl>
          {item.requiresAcknowledgement ? (
            <div className="mb-4 text-sm text-foreground">
              {item.acknowledgedAt ? (
                <p>{t("ackDone", { time: new Date(item.acknowledgedAt).toLocaleString() })}</p>
              ) : (
                <DocAcknowledgeButton documentId={item.id} label={t("ackButton")} pendingLabel={t("ackSaving")} failedLabel={t("actionFailed")} />
              )}
            </div>
          ) : null}
          {roster?.data.required ? (
            <div className="mb-4 space-y-2 text-sm text-foreground">
              <h2 className="font-semibold">{t("ackDoneTitle")}</h2>
              {roster.data.acknowledged.length === 0 ? <p>{t("ackNone")}</p> : (
                <ul>
                  {roster.data.acknowledged.map((row) => (
                    <li key={row.userId}>{row.name} · {new Date(row.acknowledgedAt).toLocaleString()}</li>
                  ))}
                </ul>
              )}
              <h2 className="font-semibold">{t("ackPendingTitle")}</h2>
              {roster.data.pending.length === 0 ? <p>{t("ackNone")}</p> : (
                <ul>
                  {roster.data.pending.map((row) => (
                    <li key={row.userId}>{row.name}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          <h2 className="mb-2 text-sm font-semibold text-foreground">{t("versionHistory")}</h2>
          <DocDetailActions
            item={item}
            versions={detail.versions}
            categories={categories.data}
            types={types.data}
            canUpdate={canDocuments(roles, "update")}
            canDelete={canDocuments(roles, "delete")}
          />
        </DataPanel>
      </div>
    </div>
  )
}
