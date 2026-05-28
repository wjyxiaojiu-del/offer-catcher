import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { resume, jdText } = await req.json()

    if (!resume) return NextResponse.json({ error: "缺少简历数据" }, { status: 400 })
    if (!jdText || jdText.trim().length < 10) return NextResponse.json({ error: "JD 内容过短，请粘贴完整的岗位描述" }, { status: 400 })

    // Try AI optimization first
    try {
      const { aiOptimizeResume } = await import("@/lib/ai")
      const result = await aiOptimizeResume(resume, jdText)
      return NextResponse.json({ report: result, source: "ai" })
    } catch (err) {
      console.warn("AI optimization failed:", err)
      return NextResponse.json({ error: "AI 分析失败，请稍后重试" }, { status: 500 })
    }
  } catch (error) {
    console.error("JD optimize error:", error)
    return NextResponse.json({ error: "分析失败" }, { status: 500 })
  }
}
