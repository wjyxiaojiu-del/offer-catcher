import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireApiAccess } from "@/lib/api-guard"
import { getDeviceIdFromRequest } from "@/lib/api-device"

// GET /api/applications - 获取投递记录
export async function GET(req: Request) {
  const authError = requireApiAccess(req)
  if (authError) return authError

  try {
    const deviceId = getDeviceIdFromRequest(req)
    const applications = await prisma.application.findMany({
      where: { deviceId: deviceId || undefined },
      orderBy: { appliedAt: "desc" },
      take: 100,
    })

    return NextResponse.json({ applications })
  } catch (error: any) {
    console.error("Get applications error:", error)
    return NextResponse.json(
      { error: "获取投递记录失败" },
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

    // Upsert: find-or-create in one atomic call (avoids race between concurrent requests)
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
      update: {},
    })

    // 创建投递记录
    const deviceId = getDeviceIdFromRequest(req)
    const application = await prisma.application.create({
      data: {
        deviceId,
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
      { error: "记录投递失败" },
      { status: 500 }
    )
  }
}

// PATCH /api/applications?id=xxx - 更新投递状态
export async function PATCH(req: Request) {
  const authError = requireApiAccess(req)
  if (authError) return authError

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json(
        { error: "缺少记录 ID" },
        { status: 400 }
      )
    }

    const { status } = await req.json()
    if (!status) {
      return NextResponse.json(
        { error: "缺少状态参数" },
        { status: 400 }
      )
    }

    const deviceId = getDeviceIdFromRequest(req)
    const application = await prisma.application.updateMany({
      where: { id, deviceId: deviceId || undefined },
      data: { status },
    })
    if (application.count === 0) {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 })
    }

    return NextResponse.json({ application })
  } catch (error: any) {
    console.error("Update application error:", error)
    return NextResponse.json(
      { error: "更新投递状态失败" },
      { status: 500 }
    )
  }
}

// DELETE /api/applications?id=xxx - 删除投递记录
export async function DELETE(req: Request) {
  const authError = requireApiAccess(req)
  if (authError) return authError

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json(
        { error: "缺少记录 ID" },
        { status: 400 }
      )
    }

    const deviceId = getDeviceIdFromRequest(req)
    const deleted = await prisma.application.deleteMany({
      where: { id, deviceId: deviceId || undefined },
    })
    if (deleted.count === 0) {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Delete application error:", error)
    return NextResponse.json(
      { error: "删除投递记录失败" },
      { status: 500 }
    )
  }
}
