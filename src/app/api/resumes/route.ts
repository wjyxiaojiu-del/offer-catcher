import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiAccess } from "@/lib/api-guard"
import { dbResumeToParsed } from "@/lib/resume-mapper"

// GET /api/resumes - 获取简历列表
export async function GET(req: Request) {
  const authError = requireApiAccess(req)
  if (authError) return authError

  try {
    const resumes = await prisma.resume.findMany({
      include: {
        educations: true,
        experiences: true,
        projects: true,
        skills: true,
      },
      orderBy: { updatedAt: "desc" },
    })

    const formattedResumes = resumes.map((resume) => {
      const parsed = dbResumeToParsed(resume)
      return {
        ...parsed,
        createdAt: resume.createdAt,
        updatedAt: resume.updatedAt,
      }
    })

    return NextResponse.json({ resumes: formattedResumes })
  } catch (error: any) {
    console.error("Get resumes error:", error)
    return NextResponse.json(
      { error: "获取简历列表失败" },
      { status: 500 }
    )
  }
}
