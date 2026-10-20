export const KPI_TABS = ["workforce", "turnover", "attendance"] as const
export type KpiTab = (typeof KPI_TABS)[number]
