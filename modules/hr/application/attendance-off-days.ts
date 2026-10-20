export type HolidaySpan = {
  startDate: string
  endDate: string
  branchIds: string[]
}

/** วันอาทิตย์ของปฏิทิน เป็นวันหยุดของทุกสาขา */
export function isSunday(dateKey: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay() === 0
}

/** วันอาทิตย์ หรือวันหยุดที่ประกาศและเลือกสาขานี้ */
export function isOffDay(dateKey: string, branchId: string, holidays: HolidaySpan[]): boolean {
  if (isSunday(dateKey)) return true
  return holidays.some(
    (holiday) =>
      holiday.branchIds.includes(branchId) && dateKey >= holiday.startDate && dateKey <= holiday.endDate
  )
}

/** วันหยุดที่ไม่มีสแกนไม่นับเป็นวันที่ต้องมา */
export function shouldSkipOffDay(
  dateKey: string,
  branchId: string,
  holidays: HolidaySpan[],
  hasPunch: boolean
): boolean {
  return isOffDay(dateKey, branchId, holidays) && !hasPunch
}
