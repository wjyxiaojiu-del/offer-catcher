import { NextResponse } from "next/server"
import {
  clearAccessCookie,
  hasConfiguredAccessToken,
  isValidAccessToken,
  makeAccessCookie,
} from "@/lib/api-guard"
import { apiError } from "@/lib/api-response"

export async function GET() {
  return NextResponse.json({
    configured: hasConfiguredAccessToken(),
    devOpen: process.env.NODE_ENV !== "production" && !hasConfiguredAccessToken(),
  })
}

export async function POST(req: Request) {
  const { token } = await req.json().catch(() => ({ token: "" }))

  if (!hasConfiguredAccessToken()) {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({ ok: true, devOpen: true })
    }
    return apiError("服务未配置访问令牌", "AUTH_NOT_CONFIGURED", 503)
  }

  if (typeof token !== "string" || !isValidAccessToken(token)) {
    return apiError("访问令牌无效", "INVALID_TOKEN", 401)
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": makeAccessCookie(token) } }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": clearAccessCookie() } }
  )
}
