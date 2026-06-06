import { NextResponse } from "next/server"
import { matchResumeToJobs } from "@/lib/matcher"
import { jobs } from "@/data/jobs"
import type { Application, ParsedResume } from "@/types"
import { apiError } from "@/lib/api-response"
import { requireApiAccess } from "@/lib/api-guard"
import { parseBody, AutoApplyBodySchema } from "@/lib/schemas"

export async function POST(req: Request) {
  const authError = requireApiAccess(req)
  if (authError) return authError

  try {
    const parsed = await parseBody(req, AutoApplyBodySchema)
    if (!parsed.ok) return apiError(parsed.error, "INVALID_INPUT", 400)
    const { config } = parsed.data
    const resume = parsed.data.resume as ParsedResume

    // Match all jobs
    const results = matchResumeToJobs(resume, jobs)

    // Filter by auto-apply criteria
    const qualified = results.filter(result => {
      const job = result.job

      // Score threshold
      if (result.score < config.minScore) return false

      // Location filter
      if (config.locations.length > 0 && !config.locations.some(loc => job.location.includes(loc))) return false

      // Salary filter
      const salaryMatch = job.salary.match(/(\d+)/)
      if (salaryMatch && parseInt(salaryMatch[1]) < config.salaryMin) return false

      // Exclude companies
      if (config.excludeCompanies.some(c => job.company.includes(c))) return false

      // Job type filter
      if (config.jobTypes.length > 0 && !config.jobTypes.some(t => job.tags.includes(t))) return false

      return true
    })

    // Limit number of applications
    const toApply = qualified.slice(0, config.maxApplications)

    // Simulate applying + persist to DB
    const appliedJobs = toApply.map(result => {
      const appData: Application = {
        id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        jobId: result.job.id,
        jobSnapshot: {
          title: result.job.title,
          company: result.job.company,
          location: result.job.location,
          salary: result.job.salary,
        },
        score: result.score,
        status: "已投递",
        appliedAt: new Date().toISOString(),
        method: "自动投递",
      }
      return appData
    })

    // Batch persist to DB (graceful fallback)
    try {
      const { prisma } = await import("@/lib/db")
      await prisma.application.createMany({
        data: appliedJobs.map(a => ({
          id: a.id,
          jobId: a.jobId,
          jobSnapshot: JSON.stringify(a.jobSnapshot),
          matchScore: a.score || 0,
          status: a.status,
          method: a.method,
          appliedAt: new Date(a.appliedAt),
        })),
      })
    } catch (dbErr) {
      console.warn("DB batch application save failed:", dbErr)
    }

    return NextResponse.json({
      success: true,
      totalMatched: results.length,
      totalQualified: qualified.length,
      totalApplied: appliedJobs.length,
      applications: appliedJobs,
      skippedJobs: qualified.slice(config.maxApplications).map(r => ({
        title: r.job.title,
        company: r.job.company,
        score: r.score,
        reason: "超过投递上限"
      }))
    })
  } catch (error) {
    console.error("Auto-apply error:", error)
    return apiError("自动投递失败", "AUTO_APPLY_ERROR", 500)
  }
}

export async function GET(req: Request) {
  const authError = requireApiAccess(req)
  if (authError) return authError

  try {
    const { prisma } = await import("@/lib/db")
    const dbApps = await prisma.application.findMany({
      where: { method: "自动投递" },
      orderBy: { appliedAt: "desc" },
      take: 100,
    })
    return NextResponse.json({ applications: dbApps })
  } catch (err) {
    console.error("Auto-apply GET error:", err)
    return apiError("获取投递记录失败", "GET_ERROR", 500)
  }
}
