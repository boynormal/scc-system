export const DRIVER_JOB_COOKIE = "scc_driver_job"

const JOB_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const LOG_PATH =
  /^\/transport\/jobs\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/log\/?$/i

const PUNCH_API =
  /^\/api\/transport\/jobs\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/punches\/?$/i

export function driverJobFromCookie(value: string | undefined | null) {
  if (!value || !JOB_ID.test(value)) return null
  return value
}

export function isDriverLogPath(pathname: string) {
  return LOG_PATH.test(pathname)
}

export function driverHomePath(cookieValue: string | undefined | null) {
  const jobId = driverJobFromCookie(cookieValue)
  return jobId ? `/transport/jobs/${jobId}/log` : "/transport/drive"
}

export function isDriverAllowedPath(pathname: string) {
  return (
    pathname === "/transport/drive" ||
    pathname.startsWith("/api/transport/driver-job") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    isDriverLogPath(pathname) ||
    PUNCH_API.test(pathname)
  )
}
