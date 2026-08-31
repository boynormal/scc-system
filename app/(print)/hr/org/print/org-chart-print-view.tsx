"use client"

import { useEffect } from "react"
import type { OrgChartNode, PersonnelOrgChart } from "@/modules/hr"

const PRINT_CSS = `
@media print {
  @page {
    size: A4 landscape;
    margin: 8mm;
  }
  html,
  body {
    background: white !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .org-print-chrome {
    display: none !important;
  }
  .org-print-sheet {
    box-shadow: none !important;
    border: none !important;
    margin: 0 !important;
    padding: 0 !important;
    width: auto !important;
  }
  .org-print-jd {
    break-before: page;
  }
  .org-print-jd-item {
    break-inside: avoid;
  }
}
`

function flatten(nodes: OrgChartNode[]): OrgChartNode[] {
  const out: OrgChartNode[] = []
  const walk = (list: OrgChartNode[]) => {
    for (const node of list) {
      out.push(node)
      walk(node.children)
    }
  }
  walk(nodes)
  return out
}

function PrintBox({ node }: { node: OrgChartNode }) {
  const active = node.occupants.filter((o) => o.isActive)
  return (
    <div className="w-44 rounded border border-slate-400 px-2 py-1.5 text-slate-900">
      <p className="text-[11px] font-bold leading-tight">{node.name}</p>
      {(node.code || node.department) && (
        <p className="text-[9px] leading-tight text-slate-600">
          {[node.code, node.department?.name].filter(Boolean).join(" · ")}
        </p>
      )}
      <div className="mt-1 border-t border-slate-300 pt-1">
        {active.length > 0 ? (
          <ul className="space-y-0.5">
            {active.map((o) => (
              <li key={o.id} className="text-[10px] leading-tight">
                {o.displayName}
                <span className="ml-1 text-[8px] text-slate-500">{o.rosterNo}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[10px] italic leading-tight text-slate-500">— ว่าง —</p>
        )}
      </div>
      {node.vacancy > 0 && (
        <p className="mt-1 text-[9px] font-semibold text-slate-700">ว่าง {node.vacancy} อัตรา</p>
      )}
    </div>
  )
}

function PrintNode({ node }: { node: OrgChartNode }) {
  return (
    <div className="flex flex-col items-center">
      <PrintBox node={node} />
      {node.children.length > 0 && (
        <>
          <div className="h-4 w-px bg-slate-400" />
          <div className="flex items-start">
            {node.children.map((child, index) => (
              <div key={child.id} className="flex flex-col items-center px-1.5">
                <div className="flex h-px w-full">
                  <div className={index > 0 ? "flex-1 bg-slate-400" : "flex-1"} />
                  <div
                    className={index < node.children.length - 1 ? "flex-1 bg-slate-400" : "flex-1"}
                  />
                </div>
                <div className="h-4 w-px bg-slate-400" />
                <PrintNode node={child} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function OrgChartPrintView({
  chart,
  companyName,
  autoPrint = false,
}: {
  chart: PersonnelOrgChart
  companyName: string
  autoPrint?: boolean
}) {
  useEffect(() => {
    if (!autoPrint) return
    const timer = window.setTimeout(() => window.print(), 400)
    return () => window.clearTimeout(timer)
  }, [autoPrint])

  const withJd = flatten(chart.roots).filter((n) => n.responsibilities.length > 0)

  return (
    <>
      <style>{PRINT_CSS}</style>

      <div className="org-print-chrome flex justify-center gap-2 px-3 py-4">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          พิมพ์ผัง
        </button>
      </div>

      <div className="flex justify-center px-3 pb-8 print:px-0 print:pb-0">
        <article className="org-print-sheet bg-white px-6 py-5 text-slate-900 shadow-sm ring-1 ring-slate-200">
          <header className="mb-4 border-b border-slate-300 pb-2 text-center">
            <h1 className="text-base font-bold">แผนผังองค์กร</h1>
            <p className="text-xs text-slate-600">
              {companyName} · {chart.branch.code} — {chart.branch.name}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              ตำแหน่ง {chart.totals.positions} · อัตรากำลัง {chart.totals.headcount} · นั่งอยู่{" "}
              {chart.totals.occupied} · ว่าง {chart.totals.vacancy}
            </p>
          </header>

          {chart.roots.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              สาขานี้ยังไม่มีตำแหน่งในผัง
            </p>
          ) : (
            <div className="flex items-start justify-center gap-6">
              {chart.roots.map((root) => (
                <PrintNode key={root.id} node={root} />
              ))}
            </div>
          )}

          {chart.unplaced.length > 0 && (
            <section className="mt-5 border-t border-slate-300 pt-2">
              <h2 className="text-[11px] font-bold">ยังไม่จัดตำแหน่ง ({chart.unplaced.length})</h2>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-700">
                {chart.unplaced.map((o) => `${o.displayName} (${o.rosterNo})`).join(" · ")}
              </p>
            </section>
          )}

          {withJd.length > 0 && (
            <section className="org-print-jd mt-6">
              <h2 className="mb-2 border-b border-slate-300 pb-1 text-sm font-bold">
                หน้าที่ความรับผิดชอบ
              </h2>
              <div className="columns-2 gap-6">
                {withJd.map((node) => (
                  <div key={node.id} className="org-print-jd-item mb-3">
                    <p className="text-[11px] font-bold">
                      {node.name}
                      {node.code ? ` (${node.code})` : ""}
                    </p>
                    <ol className="mt-0.5 list-decimal pl-4 text-[10px] leading-snug text-slate-700">
                      {node.responsibilities.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </section>
          )}
        </article>
      </div>
    </>
  )
}
