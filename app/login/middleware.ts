import { getToken } from "next-auth/jwt"
import { NextResponse } from "next/server"

export async function middleware(req: any) {
  const { pathname } = req.nextUrl

  // ログイン関連は絶対スルー
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next")
  ) {
    return NextResponse.next()
  }

  // 保護対象だけチェック
  if (
    pathname.startsWith("/event") ||
    pathname.startsWith("/schedule")
  ) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    })

    console.log("TOKEN:", token) // ← デバッグ用

    if (!token) {
      return NextResponse.redirect(
        new URL("/login", req.url)
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/:path*"],
}