import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import authConfig from "@/lib/auth.config"
import { DRIVER_JOB_COOKIE, driverHomePath, isDriverAllowedPath, isDriverLogPath } from "@/lib/driver-session"

// /api/device-sync/ ยืนยันตัวด้วย device API key ใน route เอง (lib/device-api-handler.ts)
const PUBLIC_PATHS = ["/login", "/api/auth", "/api/device-sync/"]

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) return true
  // /pm-check stays behind login. Only the QR form and its API are public.
  if (pathname === "/pm" || pathname.startsWith("/pm/")) return true
  if (pathname.startsWith("/api/pm/")) return true
  return false
}

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl } = req
  const session = req.auth
  const isPublic = isPublicPath(nextUrl.pathname)

  if (!session && !isPublic) {
    const loginUrl = new URL("/login", nextUrl)
    loginUrl.searchParams.set("callbackUrl", `${nextUrl.pathname}${nextUrl.search}`)
    return NextResponse.redirect(loginUrl)
  }

  if (session && nextUrl.pathname.startsWith("/api/auth/signout")) {
    const response = NextResponse.next()
    response.cookies.set(DRIVER_JOB_COOKIE, "", { path: "/", maxAge: 0 })
    return response
  }

  if (session?.user?.driverLogin) {
    const home = driverHomePath(req.cookies.get(DRIVER_JOB_COOKIE)?.value)
    if (nextUrl.pathname === "/login") {
      const next = nextUrl.searchParams.get("callbackUrl") ?? ""
      const pathOnly = next.startsWith("/") && !next.startsWith("//") ? (next.split("?")[0] ?? "") : ""
      return NextResponse.redirect(new URL(isDriverLogPath(pathOnly) ? pathOnly : home, nextUrl))
    }
    if (!isDriverAllowedPath(nextUrl.pathname)) {
      return NextResponse.redirect(new URL(home, nextUrl))
    }
    return NextResponse.next()
  }

  if (session && nextUrl.pathname === "/login") {
    const next = nextUrl.searchParams.get("callbackUrl")
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/"
    return NextResponse.redirect(new URL(safeNext, nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  // ไม่รัน auth บนไฟล์ static / อัปโหลด — มิฉะนั้น <img src="/uploads/...webp"> อาจได้ redirect/HTML แทนรูป
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|uploads/|.*\\.(?:png|jpg|jpeg|webp|gif|svg|ico)$).*)",
  ],
}
