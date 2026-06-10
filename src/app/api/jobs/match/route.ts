import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { aiAnalyzeMatch } from "@/lib/ai"
import { requireApiAccess } from "@/lib/api-guard"
import { dbResumeToParsed } from "@/lib/resume-mapper"
import { getDeviceIdFromRequest } from "@/lib/api-device"

// POST /api/jobs/match - 岗位匹配检查
export async function POST(req: Request) {
  const authError = requireApiAccess(req, { rateLimitKind: "ai" })
  if (authError) return authError

  try {
    const { resumeId, jobData } = await req.json()

    if (!resumeId || !jobData) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      )
    }

    // 获取简历信息
    const deviceId = getDeviceIdFromRequest(req)
    const resume = await prisma.resume.findFirst({
      where: { id: resumeId, deviceId: deviceId || undefined },
      include: {
        skills: true,
        educations: true,
        experiences: true,
        projects: true,
      },
    })

    if (!resume) {
      return NextResponse.json({ error: "简历不存在" }, { status: 404 })
    }

    // aiAnalyzeMatch wants a subset of ParsedResume — derive it from the
    // shared mapper instead of hand-rolling another copy.
    const parsed = dbResumeToParsed(resume)
    const resumeData = {
      name: parsed.name,
      skills: parsed.skills,
      education: parsed.education,
      experience: parsed.experience,
      projects: parsed.projects,
      summary: parsed.summary || "",
    }

    // 构建岗位数据
    const jobInfo = {
      title: jobData.title,
      company: jobData.company,
      description: jobData.description || "",
      requirements: jobData.requirements || [],
      skills: jobData.skills || [],
      education: jobData.education || "",
      experience: jobData.experience || "",
    }

    // 调用 AI 分析匹配度
    const matchResult = await aiAnalyzeMatch(resumeData, jobInfo)

    return NextResponse.json({
      matchResult: {
        score: matchResult.score,
        matchLevel:
          matchResult.score >= 80
            ? "excellent"
            : matchResult.score >= 60
            ? "good"
            : matchResult.score >= 40
            ? "fair"
            : "weak",
        matchedSkills: matchResult.skillMatch?.matched || [],
        missingSkills: matchResult.skillMatch?.missing || [],
        suggestions: matchResult.suggestions || [],
        analysis: matchResult.analysis || "",
      },
    })
  } catch (error: any) {
    console.error("Match job error:", error)
    return NextResponse.json(
      { error: "匹配分析失败" },
      { status: 500 }
    )
  }
}
