import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiAccess } from "@/lib/api-guard"

// GET /api/resumes/[id] - 获取简历详情
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireApiAccess(req)
  if (authError) return authError

  try {
    const { id } = await params

    const resume = await prisma.resume.findUnique({
      where: { id },
      include: {
        educations: true,
        experiences: true,
        projects: true,
        skills: true,
      },
    })

    if (!resume) {
      return NextResponse.json({ error: "简历不存在" }, { status: 404 })
    }

    // 转换数据格式
    const formattedResume = {
      id: resume.id,
      name: resume.name,
      email: resume.email,
      phone: resume.phone,
      summary: resume.summary,
      rawText: resume.rawText,
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
    }

    return NextResponse.json({ resume: formattedResume })
  } catch (error: any) {
    console.error("Get resume error:", error)
    return NextResponse.json(
      { error: error.message || "获取简历详情失败" },
      { status: 500 }
    )
  }
}
