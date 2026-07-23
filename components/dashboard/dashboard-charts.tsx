"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts"

type MachineStatusItem = { name: string; value: number; color: string }
type CostTrendItem = { month: string; cost: number }
type WorkOrderMonthItem = { month: string; [key: string]: string | number }

export function DashboardCharts({
  machineStatusData,
  costTrendData,
  workOrdersData,
}: {
  machineStatusData: MachineStatusItem[]
  costTrendData: CostTrendItem[]
  workOrdersData: WorkOrderMonthItem[]
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">สถานะเครื่องจักร</h2>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={machineStatusData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }: { name: string; percent: number }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {machineStatusData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">แนวโน้มค่าใช้จ่ายซ่อมบำรุง</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={costTrendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(v: number) => `฿${v}`} />
            <Tooltip formatter={(v: number) => [`฿${v}`, "ค่าใช้จ่าย"]} />
            <Line type="monotone" dataKey="cost" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm lg:col-span-2">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">ใบสั่งงานรายเดือน (แยกตามสถานะ)</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={workOrdersData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="completed" stackId="a" fill="#10b981" name="เสร็จสิ้น" />
            <Bar dataKey="in_progress" stackId="a" fill="#3b82f6" name="กำลังดำเนินการ" />
            <Bar dataKey="open" stackId="a" fill="#f59e0b" name="รอดำเนินการ" />
            <Bar dataKey="cancelled" stackId="a" fill="#ef4444" name="ยกเลิก" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
