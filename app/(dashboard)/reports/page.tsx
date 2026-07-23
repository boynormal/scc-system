import { Metadata } from "next"
import { BarChart3 } from "lucide-react"

export const metadata: Metadata = { title: "รายงาน" }

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">รายงาน</h1>
        <p className="text-slate-500 text-sm mt-1">วิเคราะห์และส่งออกรายงานซ่อมบำรุง</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">Reports & Analytics</p>
        <p className="text-slate-400 text-sm mt-1">Phase 5 — กำลังพัฒนา</p>
      </div>
    </div>
  )
}
