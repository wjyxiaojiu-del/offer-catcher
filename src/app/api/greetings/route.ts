import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { callLLM } from "@/lib/ai"
import { requireApiAccess } from "@/lib/api-guard"

// POST /api/greetings/generate - 生成 AI 招呼语
export async function POST(req: Request) {
  const authError = requireApiAccess(req, { rateLimitKind: "ai" })
  if (authError) return authError

  let jobData: any = null
  try {
    const body = await req.json()
    const resumeId = body.resumeId
    jobData = body.jobData

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

    // 构建简历摘要
    const resumeSummary = `
姓名: ${resume.name}
技能: ${resume.skills.map((s) => s.name).join(", ")}
教育: ${resume.educations.map((e) => `${e.school} ${e.degree} ${e.major}`).join("; ")}
经历: ${resume.experiences.map((e) => `${e.company} ${e.title}`).join("; ")}
项目: ${resume.projects.map((p) => p.name).join("; ")}
    `.trim()

    // 构建岗位信息
    const jobInfo = `
岗位: ${jobData.title}
公司: ${jobData.company}
薪资: ${jobData.salary || "面议"}
要求: ${jobData.experience || ""} ${jobData.education || ""}
描述: ${jobData.description || "无"}
    `.trim()

    // 调用 AI 生成招呼语
    const systemPrompt = `你是一个求职助手。根据岗位信息和候选人简历，生成一句简短专业的打招呼语。

要求：
1. 50字以内
2. 语气自然友好
3. 突出候选人与岗位的匹配点
4. 不要过于模板化
5. 直接输出招呼语，不要其他内容`

    const userPrompt = `候选人简历：
${resumeSummary}

目标岗位：
${jobInfo}

请生成一句个性化的打招呼语：`

    const greeting = await callLLM(systemPrompt, userPrompt)

    return NextResponse.json({
      greeting: greeting || `您好，我对${jobData.title}岗位很感兴趣，希望有机会沟通。`,
    })
  } catch (error: any) {
    console.error("Generate greeting error:", error)
    return NextResponse.json(
      {
        greeting: `您好，我对${jobData?.title || "该"}岗位很感兴趣，希望有机会沟通。`,
        error: error.message,
      },
      { status: 200 } // 降级处理，不返回错误
    )
  }
}
