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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
}
