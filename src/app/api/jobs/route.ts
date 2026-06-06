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

    // Atomic upsert: avoids race condition on concurrent duplicate submissions
    const job = await prisma.job.upsert({
      where: { title_company: { title: jobData.title, company: jobData.company } },
      create: {
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
      update: {
        location: jobData.location || undefined,
        salaryText: jobData.salary || undefined,
        experience: jobData.experience || undefined,
        education: jobData.education || undefined,
        description: jobData.description || undefined,
        requirements: JSON.stringify(jobData.requirements || []),
        skills: JSON.stringify(jobData.skills || []),
        applyUrl: jobData.url || undefined,
      },
    })

    return NextResponse.json({ job })
  } catch (error: any) {
    console.error("Save job error:", error)
    return NextResponse.json(
      { error: "保存岗位失败" },
      { status: 500 }
    )
  }
}
