import { NextResponse } from "next/server"
import { matchResumeToJobs, MatchResult } from "@/lib/matcher"
import { jobs, Job } from "@/data/jobs"

interface AutoApplyConfig {
  minScore: number        // 最低匹配分
  maxApplications: number // 最多投递数
  locations: string[]     // 期望城市
  salaryMin: number       // 最低薪资(K)
  excludeCompanies: string[] // 排除公司
  jobTypes: string[]      // 岗位类型标签
}

// In-memory store
const applications: Map<string, any> = new Map()

export async function POST(req: Request) {
  try {
    const { resume, config }: { resume: any; config: AutoApplyConfig } = await req.json()

    if (!resume) return NextResponse.json({ error: "No resume data" }, { status: 400 })

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

    // Simulate applying
    const appliedJobs = toApply.map(result => {
      const application = {
        id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        jobId: result.job.id,
        jobTitle: result.job.title,
        company: result.job.company,
        location: result.job.location,
        salary: result.job.salary,
        score: result.score,
        status: "已投递",
        appliedAt: new Date().toISOString(),
        resumeName: resume.name || "匿名",
        method: "自动投递"
      }

      applications.set(application.id, application)
      return application
    })

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
    return NextResponse.json({ error: "自动投递失败" }, { status: 500 })
  }
}

export async function GET() {
  const allApps = Array.from(applications.values())
  return NextResponse.json({ applications: allApps })
}
