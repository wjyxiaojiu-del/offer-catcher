import { z } from "zod"

// ============================================================
// Runtime request-body schemas (zod)
// ============================================================
// TS types are compile-time only — a malformed request still reaches the
// handler at runtime. These schemas validate/normalize bodies so a bad
// payload returns 400 instead of crashing a handler with a 500.
//
// Philosophy: lenient where safe (default arrays/numbers so `.some`/`.length`
// never hit undefined), strict only where a wrong value would corrupt logic.

// Minimal resume shape the API consumers actually rely on. We keep nested
// arrays permissive (passthrough objects) — the matcher tolerates partial
// entries; we only guarantee the arrays themselves exist.
export const ParsedResumeSchema = z
  .object({
    name: z.string().default(""),
    email: z.string().default(""),
    phone: z.string().default(""),
    education: z.array(z.any()).default([]),
    experience: z.array(z.any()).default([]),
    skills: z.array(z.string()).default([]),
    projects: z.array(z.any()).default([]),
    rawText: z.string().default(""),
    source: z.string().optional(),
    summary: z.string().optional(),
    id: z.string().optional(),
  })
  .passthrough()

export const AutoApplyConfigSchema = z.object({
  minScore: z.number().min(0).max(100).default(0),
  maxApplications: z.number().int().min(0).max(100).default(10),
  locations: z.array(z.string()).default([]),
  salaryMin: z.number().min(0).default(0),
  excludeCompanies: z.array(z.string()).default([]),
  jobTypes: z.array(z.string()).default([]),
})

export const AutoApplyBodySchema = z.object({
  resume: ParsedResumeSchema,
  // Each config field has its own default, so coercing a missing/empty
  // object through the schema still yields a fully-populated config.
  config: z.preprocess((v) => v ?? {}, AutoApplyConfigSchema),
})

export const JdOptimizeBodySchema = z.object({
  resume: ParsedResumeSchema,
  jdText: z.string().trim().min(10, "JD 内容过短，请粘贴完整的岗位描述"),
  sessionId: z.string().optional(),
})

export const AgentChatBodySchema = z.object({
  message: z.string().trim().min(1, "消息不能为空").max(8000, "消息过长"),
  sessionId: z.string().optional(),
  resumeText: z.string().max(50000).optional(),
  userId: z.string().optional(),
})

export const ResumeTextBodySchema = z.object({
  text: z.string().trim().min(1, "简历内容不能为空").max(50000, "简历内容过长"),
})

// BOSS automation: action is required; the rest are action-specific and
// validated loosely (the route switches on action).
export const BossBodySchema = z.object({
  action: z.enum([
    "launch",
    "login-status",
    "wait-login",
    "search",
    "apply",
    "progress",
    "screenshot",
    "close",
  ]),
  config: z.any().optional(),
  resumeSkills: z.array(z.string()).optional(),
  resumeId: z.string().optional(),
  taskId: z.string().optional(),
})

export type AutoApplyBody = z.infer<typeof AutoApplyBodySchema>
export type JdOptimizeBody = z.infer<typeof JdOptimizeBodySchema>
export type AgentChatBody = z.infer<typeof AgentChatBodySchema>
export type ResumeTextBody = z.infer<typeof ResumeTextBodySchema>
export type BossBody = z.infer<typeof BossBodySchema>

// ------------------------------------------------------------------
// Helper: parse a Request JSON body against a schema.
// Returns a discriminated union on `ok` so callers get proper narrowing.
// ------------------------------------------------------------------
export async function parseBody<T>(
  req: Request,
  schema: z.ZodType<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return { ok: false, error: "请求体不是合法的 JSON" }
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    const first = result.error.issues[0]
    return { ok: false, error: first?.message || "参数校验失败" }
  }
  return { ok: true, data: result.data }
}
