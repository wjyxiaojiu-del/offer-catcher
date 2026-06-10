import { NextResponse } from "next/server"
import { matchResumeToJobs, generateOptimizationReport } from "@/lib/matcher"
import { withTimeout } from "@/lib/utils"
import { requireApiAccess } from "@/lib/api-guard"
import { dbResumeToParsed } from "@/lib/resume-mapper"
import { getAllJobs } from "@/lib/job-service"
import { getDeviceIdFromRequest } from "@/lib/api-device"
import { apiError } from "@/lib/api-response"
import type { ParsedResume } from "@/types"

export async function POST(req: Request) {
  const authError = requireApiAccess(req, { rateLimitKind: "ai" })
  if (authError) return authError

  try {
    const { resume, resumeId, jobId }: { resume?: ParsedResume; resumeId?: string; jobId?: string } = await req.json()
    const deviceId = getDeviceIdFromRequest(req)

    // Load resume from DB if resumeId provided
    let resolvedResume: ParsedResume
    if (resumeId) {
      try {
        const { prisma } = await import("@/lib/db")
        const record = await prisma.resume.findFirst({
          where: { id: resumeId, deviceId: deviceId || undefined },
          include: { educations: true, experiences: true, projects: true, skills: true },
        })
        if (record) {
          resolvedResume = dbResumeToParsed(record)
        } else {
          if (!resume) return apiError("缺少简历数据", "MISSING_RESUME", 400)
          resolvedResume = resume
        }
      } catch {
        if (!resume) return apiError("缺少简历数据", "MISSING_RESUME", 400)
        resolvedResume = resume
      }
    } else if (resume) {
      resolvedResume = resume
    } else {
      return apiError("缺少简历数据", "MISSING_RESUME", 400)
    }

    // 从数据库获取岗位
    const allJobs = await getAllJobs()

    // If jobId is provided, generate optimization report for that specific job
    if (jobId) {
      const job = allJobs.find((j) => j.id === jobId)
      if (!job) return apiError("岗位不存在", "JOB_NOT_FOUND", 404)
      const report = generateOptimizationReport(resolvedResume, job)
      return NextResponse.json({ report, job })
    }

    // Rule-based matching first (fast, always works, < 50ms)
    const results = matchResumeToJobs(resolvedResume, allJobs)

    // ========== FIX: Reduce LLM concurrency ==========
    // Old: Promise.allSettled on top 5 = 5 concurrent LLM calls (very slow, easy to hit rate limits)
    // New: Sequential AI enrichment for top 3 only, each with 5s timeout.
    // This keeps response time < 3s total instead of 10s+.

    try {
      const { aiAnalyzeMatch } = await import("@/lib/ai")
      const topN = 3

      for (let i = 0; i < Math.min(topN, results.length); i++) {
        const result = results[i]
        const aiResult = await withTimeout(
          aiAnalyzeMatch(resolvedResume, {
            title: result.job.title,
            company: result.job.company,
            description: result.job.description,
            requirements: result.job.requirements,
            skills: result.job.skills,
            education: result.job.education,
            experience: result.job.experience,
          }),
          5000,
          null
        )

        if (aiResult) {
          result.aiAnalysis = typeof aiResult.analysis === "string" ? aiResult.analysis : String(aiResult.analysis ?? "")
          result.score = Math.round((result.score + (typeof aiResult.score === "number" ? aiResult.score : 50)) / 2)
          const matched = Array.isArray(aiResult.skillMatch?.matched) ? aiResult.skillMatch.matched : []
          const missing = Array.isArray(aiResult.skillMatch?.missing) ? aiResult.skillMatch.missing : []
          result.matchedSkills = matched.length > 0 ? matched : result.matchedSkills
          result.missingSkills = missing.length > 0 ? missing : result.missingSkills
          result.suggestions = Array.isArray(aiResult.suggestions) && aiResult.suggestions.length > 0
            ? aiResult.suggestions
            : result.suggestions
          result.aiPowered = true
        }
      }
    } catch (err) {
      console.warn("AI enrichment failed, using rule-based results:", err)
    }

    return NextResponse.json({ results })
  } catch (error: any) {
    console.error("Match error:", error.message, error.stack)
    return apiError("匹配失败，请稍后重试", "MATCH_ERROR", 500)
  }
}
