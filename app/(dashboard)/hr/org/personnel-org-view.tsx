import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { GlassCard } from "@/components/glass"
import type { PersonnelOrgCard, PersonnelOrgView } from "@/modules/hr"

function PersonRow({ person }: { person: PersonnelOrgCard }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border/60 py-2.5 last:border-0">
      <div className="min-w-0">
        <Link href={`/hr/personnel/${person.id}`} className="font-medium text-foreground hover:underline">
          {person.displayName}
        </Link>
        <span className="text-muted-foreground"> — {person.jobGroup?.trim() || "—"}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{person.rosterNo}</span>
        {!person.isActive && <Badge variant="outline">ปิด</Badge>}
      </div>
    </li>
  )
}

export function PersonnelOrgView({ view }: { view: PersonnelOrgView }) {
  const emptyOrg = view.departments.length === 0 && view.unassigned.length === 0

  if (emptyOrg) {
    return (
      <GlassCard className="px-5 py-12 text-center">
        <p className="text-sm font-medium text-foreground">ยังไม่มีแผนกหรือบุคลากรในสาขานี้</p>
        <p className="mt-1 text-sm text-muted-foreground">เพิ่มแผนกในตั้งค่า หรือผูกแผนกให้บุคลากรจากทะเบียน</p>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-4">
      {view.departments.map((dept) => (
        <GlassCard key={dept.id} padding="sm" className="px-5 py-4">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              {dept.name}
              {dept.code ? <span className="ml-2 font-normal text-muted-foreground">({dept.code})</span> : null}
            </h2>
            <span className="text-xs text-muted-foreground">{dept.personnelCount} คน</span>
          </div>
          {dept.personnel.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">ไม่มีบุคลากร</p>
          ) : (
            <ul>
              {dept.personnel.map((p) => (
                <PersonRow key={p.id} person={p} />
              ))}
            </ul>
          )}
        </GlassCard>
      ))}

      {view.unassigned.length > 0 && (
        <GlassCard padding="sm" className="px-5 py-4">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">ยังไม่จัดแผนก</h2>
            <span className="text-xs text-muted-foreground">{view.unassigned.length} คน</span>
          </div>
          <ul>
            {view.unassigned.map((p) => (
              <PersonRow key={p.id} person={p} />
            ))}
          </ul>
        </GlassCard>
      )}
    </div>
  )
}
