import { NextResponse } from "next/server"
import { CareerAgent } from "@/lib/agent/career-agent"
import { aiOptimizeResume } from "@/lib/ai"
import { requireApiAccess } from "@/lib/api-guard"
import type { ParsedResume } from "@/types"

export async function POST(req: Request) {
  const authError = requireApiAccess(req, { rateLimitKind: "ai" })
  if (authError) return authError

  try {
    const {
      resume,
      jdText,
      sessionId,
    }: {
      resume: ParsedResume
      jdText: string
      sessionId?: string
    } = await req.json()

    if (!resume) {
      return NextResponse.json({ error: "缺少简历数据" }, { status: 400 })
    }
    if (!jdText || jdText.trim().length < 10) {
      return NextResponse.json(
        { error: "JD 内容过短，请粘贴完整的岗位描述" },
        { status: 400 }
      )
    }

    let targetResume = resume

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
