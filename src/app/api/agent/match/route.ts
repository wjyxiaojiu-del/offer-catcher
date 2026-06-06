import { NextResponse } from "next/server"
import { CareerAgent } from "@/lib/agent/career-agent"
import { prisma } from "@/lib/db"
import { requireApiAccess } from "@/lib/api-guard"
import type { ParsedResume, MatchResult } from "@/types"

export async function POST(req: Request) {
  const authError = requireApiAccess(req, { rateLimitKind: "ai" })
  if (authError) return authError

  try {
    const {
      resumeText,
      resumeId,
      filterTags,
      sessionId,
    }: {
      resumeText?: string
      resumeId?: string
      filterTags?: string[]
      sessionId?: string
    } = await req.json()

    const sid = sessionId || crypto.randomUUID()
    const agent = new CareerAgent({ sessionId: sid })
    await agent.init()

    const thinking: string[] = []

    // Try to load resume from agent memory / DB / request
    let hasResume = false

    if (resumeText && resumeText.trim().length > 0) {
      thinking.push("📄 从请求中解析简历...")
      await agent.parseResume(resumeText)
      hasResume = true
    } else if (resumeId) {
      thinking.push("📄 从数据库加载简历...")
      try {
        const record = await prisma.resume.findUnique({
          where: { id: resumeId },
          include: { educations: true, experiences: true, projects: true, skills: true },
        })
        if (record) {
          const dbResume: ParsedResume = {
            name: record.name,
            email: record.email,
            phone: record.phone,
            rawText: record.rawText,
            source: record.source as "ai" | "rule",
            summary: record.summary || undefined,
            id: record.id,
            education: record.educations.map((e) => ({
              school: e.school, major: e.major, degree: e.degree,
              year: e.year, startYear: e.startYear || undefined,
              endYear: e.endYear || undefined, gpa: e.gpa || undefined,
            })),
            experience: record.experiences.map((e) => ({
              company: e.company, title: e.title, duration: e.duration,
              description: e.description, startDate: e.startDate || undefined,
              endDate: e.endDate || undefined,
            })),
            projects: record.projects.map((p) => {
              let techStack: string[] = []
              try { techStack = JSON.parse(p.techStack) } catch { techStack = [] }
              return { name: p.name, description: p.description, techStack }
            }),
            skills: record.skills.map((s) => s.name),
          }
          // Seed into agent context
          await agent.parseResume(dbResume.rawText)
          hasResume = true
        }
      } catch (dbErr) {
        console.warn("DB load failed:", dbErr)
        thinking.push("⚠️ 数据库加载失败")
      }
    }

    // Try session memory as last resort
    if (!hasResume) {
      const mem = await agent.getMemory()
      const memResume = mem.resume as ParsedResume | undefined
      if (memResume?.rawText) {
        thinking.push("📄 从会话记忆中恢复简历...")
        await agent.parseResume(memResume.rawText)
        hasResume = true
      }
    }

    if (!hasResume) {
      return NextResponse.json(
        { error: "未找到简历，请先上传简历或提供 resumeText", thinking },
        { status: 400 }
      )
    }

    thinking.push("🎯 正在匹配岗位...")
    const results = await agent.matchJobs({ tags: filterTags, topN: 10 })

    thinking.push(`✅ 匹配完成，找到 ${results.length} 个结果`)

    return NextResponse.json({
      results,
      thinking,
      source: "agent" as const,
      sessionId: sid,
    })
  } catch (error: any) {
    console.error("Agent match error:", error)
    return NextResponse.json(
      { error: error.message || "匹配失败", thinking: ["执行过程中发生错误"] },
      { status: 500 }
    )
  }
}
