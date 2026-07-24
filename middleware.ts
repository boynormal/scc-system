import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import authConfig from "@/lib/auth.config"

const PUBLIC_PATHS = ["/login", "/api/auth"]

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl } = req
  const session = req.auth
  const isPublic = PUBLIC_PATHS.some((p) => nextUrl.pathname.startsWith(p))

  if (!session && !isPublic) {
    return NextResponse.redirect(new URL("/login", nextUrl))
  }

  if (session && nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/", nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  // ไม่รัน auth บนไฟล์ static / อัปโหลด — มิฉะนั้น <img src="/uploads/...webp"> อาจได้ redirect/HTML แทนรูป
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|uploads/|.*\\.(?:png|jpg|jpeg|webp|gif|svg|ico)$).*)",
  ],
}
