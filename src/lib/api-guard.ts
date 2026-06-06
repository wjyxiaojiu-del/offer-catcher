import { NextResponse } from "next/server"
import { apiError } from "@/lib/api-response"

type LimitKind = "general" | "ai" | "boss"

const COOKIE_NAME = "offer_catcher_access"
const WINDOW_MS = 60_000

const LIMITS: Record<LimitKind, number> = {
  general: 120,
  ai: 20,
  boss: 10,
}

const buckets = new Map<string, { count: number; resetAt: number }>()

function configuredToken(): string | undefined {
  return process.env.OFFER_CATCHER_ACCESS_TOKEN || process.env.OFFER_CATCHER_API_TOKEN
}

function tokenFromCookie(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined
  const cookies = cookieHeader.split(";").map((part) => part.trim())
  const cookie = cookies.find((part) => part.startsWith(`${COOKIE_NAME}=`))
  if (!cookie) return undefined
  return decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1))
}

function tokenFromRequest(req: Request): string | undefined {
  const auth = req.headers.get("authorization")
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim()
  }
  return req.headers.get("x-offer-catcher-token") || tokenFromCookie(req.headers.get("cookie"))
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

function clientKey(req: Request, kind: LimitKind): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const realIp = req.headers.get("x-real-ip")
  return `${kind}:${forwarded || realIp || "local"}`
}

export function rateLimit(req: Request, kind: LimitKind = "general"): NextResponse | null {
  const now = Date.now()
  const key = clientKey(req, kind)
  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return null
  }

  current.count += 1
  if (current.count > LIMITS[kind]) {
    return apiError("请求过于频繁，请稍后重试", "RATE_LIMITED", 429)
  }

  return null
}

export function requireApiAccess(
  req: Request,
  options: { rateLimitKind?: LimitKind } = {}
): NextResponse | null {
  const limited = rateLimit(req, options.rateLimitKind || "general")
  if (limited) return limited

  const token = configuredToken()
  if (!token) {
    if (process.env.NODE_ENV !== "production") return null
    return apiError(
      "服务未配置访问令牌，已拒绝公开访问",
      "AUTH_NOT_CONFIGURED",
      503
    )
  }

  const provided = tokenFromRequest(req)
  if (provided && safeEqual(provided, token)) return null

  return apiError("未授权访问", "UNAUTHORIZED", 401)
}

export function requireBossAutomation(req: Request): NextResponse | null {
  const auth = requireApiAccess(req, { rateLimitKind: "boss" })
  if (auth) return auth

  if (process.env.BOSS_AUTOMATION_ENABLED !== "true") {
    return apiError(
      "BOSS 自动化未启用，请在可信本地环境设置 BOSS_AUTOMATION_ENABLED=true",
      "BOSS_DISABLED",
      403
    )
  }

  return null
}

export function makeAccessCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}`
}

export function clearAccessCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`
}

export function hasConfiguredAccessToken(): boolean {
  return Boolean(configuredToken())
}

export function isValidAccessToken(value: string): boolean {
  const token = configuredToken()
  return Boolean(token && safeEqual(value, token))
}
