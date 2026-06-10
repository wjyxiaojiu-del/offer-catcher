import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiAccess } from "@/lib/api-guard"
import { apiError } from "@/lib/api-response"
import { dbResumeToParsed } from "@/lib/resume-mapper"
import { getDeviceIdFromRequest } from "@/lib/api-device"

// GET /api/resumes/[id] - 获取简历详情
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireApiAccess(req)
  if (authError) return authError

  try {
    const { id } = await params

    const deviceId = getDeviceIdFromRequest(req)
    const resume = await prisma.resume.findFirst({
      where: { id, deviceId: deviceId || undefined },
      include: {
        educations: true,
        experiences: true,
        projects: true,
        skills: true,
      },
    })

    if (!resume) {
      return apiError("简历不存在", "NOT_FOUND", 404)
    }

    const parsed = dbResumeToParsed(resume)
    const formattedResume = {
      ...parsed,
      createdAt: resume.createdAt,
      updatedAt: resume.updatedAt,
    }

    return NextResponse.json({ resume: formattedResume })
  } catch (error: any) {
    console.error("Get resume error:", error)
    return apiError("获取简历详情失败", "GET_ERROR", 500)
  }
}
