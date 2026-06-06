import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiAccess } from "@/lib/api-guard"

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

    // 转换数据格式
    const formattedResumes = resumes.map((resume) => ({
      id: resume.id,
      name: resume.name,
      email: resume.email,
      phone: resume.phone,
      summary: resume.summary,
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
      createdAt: resume.createdAt,
      updatedAt: resume.updatedAt,
    }))

    return NextResponse.json({ resumes: formattedResumes })
  } catch (error: any) {
    console.error("Get resumes error:", error)
    return NextResponse.json(
      { error: error.message || "获取简历列表失败" },
      { status: 500 }
    )
  }
}
