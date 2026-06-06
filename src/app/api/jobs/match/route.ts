import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { aiAnalyzeMatch } from "@/lib/ai"
import { requireApiAccess } from "@/lib/api-guard"

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
    const resume = await prisma.resume.findUnique({
      where: { id: resumeId },
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

    // 构建简历数据
    const resumeData = {
      name: resume.name,
      skills: resume.skills.map((s) => s.name),
      education: resume.educations.map((e) => ({
        school: e.school,
        major: e.major,
        degree: e.degree,
        year: e.year,
      })),
      experience: resume.experiences.map((e) => ({
        company: e.company,
        title: e.title,
        duration: e.duration,
        description: e.description,
      })),
      projects: resume.projects.map((p) => ({
        name: p.name,
        description: p.description,
        techStack: JSON.parse(p.techStack || "[]"),
      })),
      summary: resume.summary || "",
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
      { error: error.message || "匹配分析失败" },
      { status: 500 }
    )
  }
}
