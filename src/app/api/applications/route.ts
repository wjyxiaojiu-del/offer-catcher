import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiAccess } from "@/lib/api-guard"

// GET /api/applications - 获取投递记录
export async function GET(req: Request) {
  const authError = requireApiAccess(req)
  if (authError) return authError

  try {
    const applications = await prisma.application.findMany({
      orderBy: { appliedAt: "desc" },
      take: 100,
    })

    return NextResponse.json({ applications })
  } catch (error: any) {
    console.error("Get applications error:", error)
    return NextResponse.json(
      { error: error.message || "获取投递记录失败" },
      { status: 500 }
    )
  }
}

// POST /api/applications - 记录投递
export async function POST(req: Request) {
  const authError = requireApiAccess(req)
  if (authError) return authError

  try {
    const { resumeId, jobData, greeting, matchScore, method } = await req.json()

    if (!resumeId || !jobData) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      )
    }

    // 保存岗位信息
    let job = await prisma.job.findFirst({
      where: {
        title: jobData.title,
        company: jobData.company,
      },
    })

    if (!job) {
      job = await prisma.job.create({
        data: {
          title: jobData.title,
          company: jobData.company,
          location: jobData.location || "",
          salaryText: jobData.salary || "",
          experience: jobData.experience || "",
          education: jobData.education || "",
          description: jobData.description || "",
          requirements: JSON.stringify(jobData.requirements || []),
          skills: JSON.stringify(jobData.skills || []),
          applyUrl: jobData.url || "",
          source: "boss_extension",
        },
      })
    }

    // 创建投递记录
    const application = await prisma.application.create({
      data: {
        resumeId,
        jobId: job.id,
        jobSnapshot: JSON.stringify({
          title: jobData.title,
          company: jobData.company,
          location: jobData.location,
          salary: jobData.salary,
          experience: jobData.experience,
          education: jobData.education,
          description: jobData.description,
          url: jobData.url,
        }),
        matchScore: matchScore || null,
        status: "applied",
        method: method === "auto" ? "boss_auto" : "boss_manual",
        notes: greeting || null,
      },
    })

    return NextResponse.json({ application })
  } catch (error: any) {
    console.error("Create application error:", error)
    return NextResponse.json(
      { error: error.message || "记录投递失败" },
      { status: 500 }
    )
  }
}
