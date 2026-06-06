import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiAccess } from "@/lib/api-guard"

// POST /api/jobs - 保存岗位信息
export async function POST(req: Request) {
  const authError = requireApiAccess(req)
  if (authError) return authError

  try {
    const jobData = await req.json()

    if (!jobData.title || !jobData.company) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      )
    }

    // 检查是否已存在
    let job = await prisma.job.findFirst({
      where: {
        title: jobData.title,
        company: jobData.company,
      },
    })

    if (job) {
      // 更新现有岗位
      job = await prisma.job.update({
        where: { id: job.id },
        data: {
          location: jobData.location || job.location,
          salaryText: jobData.salary || job.salaryText,
          experience: jobData.experience || job.experience,
          education: jobData.education || job.education,
          description: jobData.description || job.description,
          requirements: JSON.stringify(jobData.requirements || []),
          skills: JSON.stringify(jobData.skills || []),
          applyUrl: jobData.url || job.applyUrl,
          updatedAt: new Date(),
        },
      })
    } else {
      // 创建新岗位
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

    return NextResponse.json({ job })
  } catch (error: any) {
    console.error("Save job error:", error)
    return NextResponse.json(
      { error: error.message || "保存岗位失败" },
      { status: 500 }
    )
  }
}
