import { NextResponse } from "next/server"
import { CareerAgent } from "@/lib/agent/career-agent"
import { aiOptimizeResume } from "@/lib/ai"
import { requireApiAccess } from "@/lib/api-guard"
import { apiError } from "@/lib/api-response"
import { parseBody, JdOptimizeBodySchema } from "@/lib/schemas"
import type { ParsedResume } from "@/types"

export async function POST(req: Request) {
  const authError = requireApiAccess(req, { rateLimitKind: "ai" })
  if (authError) return authError

  try {
    const parsed = await parseBody(req, JdOptimizeBodySchema)
    if (!parsed.ok) return apiError(parsed.error, "INVALID_INPUT", 400)
    const { jdText, sessionId } = parsed.data
    let targetResume = parsed.data.resume as ParsedResume

    // Load from agent memory if sessionId provided
    if (sessionId) {
      try {
        const agent = new CareerAgent({ sessionId })
        await agent.init()
        const mem = await agent.getMemory()
        if (mem.resume) {
          targetResume = mem.resume as ParsedResume
        }
      } catch {
        // ignore, use provided resume
      }
    }

    // Use aiOptimizeResume directly since we have jdText (not jobId from DB)
    try {
      const result = await aiOptimizeResume(targetResume, jdText)
      return NextResponse.json({ report: result, source: "agent" as const })
    } catch (err) {
      console.warn("AI optimization failed:", err)
      return NextResponse.json(
        { error: "AI 分析失败，请稍后重试" },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("JD optimize error:", error)
    return NextResponse.json({ error: "分析失败" }, { status: 500 })
  }
}
