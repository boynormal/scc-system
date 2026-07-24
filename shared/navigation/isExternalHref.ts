/** ตรวจว่า href เป็นลิงก์ออกนอกแอป (เช่น หน้าควบคุมอุปกรณ์ IoT ในเครือข่าย LAN) หรือเป็น route ภายในแอป */
export function isExternalHref(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(href)
}
