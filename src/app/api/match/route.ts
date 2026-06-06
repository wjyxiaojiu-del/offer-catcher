import { NextResponse } from "next/server"
import { matchResumeToJobs, generateOptimizationReport } from "@/lib/matcher"
import { withTimeout } from "@/lib/utils"
import { requireApiAccess } from "@/lib/api-guard"
import { jobs } from "@/data/jobs"
import type { ParsedResume } from "@/types"

export async function POST(req: Request) {
  const authError = requireApiAccess(req, { rateLimitKind: "ai" })
  if (authError) return authError

  try {
    const { resume, resumeId, jobId }: { resume?: ParsedResume; resumeId?: string; jobId?: string } = await req.json()

    // Load resume from DB if resumeId provided
    let resolvedResume: ParsedResume
    if (resumeId) {
      try {
        const { prisma } = await import("@/lib/db")
        const record = await prisma.resume.findUnique({
          where: { id: resumeId },
          include: { educations: true, experiences: true, projects: true, skills: true },
        })
        if (record) {
          resolvedResume = {
            name: record.name,
            email: record.email,
            phone: record.phone,
            rawText: record.rawText,
            source: record.source as "ai" | "rule",
            summary: record.summary || undefined,
            id: record.id,
            education: record.educations.map((e) => ({
              school: e.school, major: e.major, degree: e.degree,
              year: e.year, startYear: e.startYear || undefined,
              endYear: e.endYear || undefined, gpa: e.gpa || undefined,
            })),
            experience: record.experiences.map((e) => ({
              company: e.company, title: e.title, duration: e.duration,
              description: e.description, startDate: e.startDate || undefined,
              endDate: e.endDate || undefined,
            })),
            projects: record.projects.map((p) => {
              let techStack: string[] = []
              try { techStack = JSON.parse(p.techStack) } catch { techStack = [] }
              return { name: p.name, description: p.description, techStack }
            }),
            skills: record.skills.map((s) => s.name),
          }
        } else {
          if (!resume) return NextResponse.json({ error: "No resume data" }, { status: 400 })
          resolvedResume = resume
        }
      } catch {
        if (!resume) return NextResponse.json({ error: "No resume data" }, { status: 400 })
        resolvedResume = resume
      }
    } else if (resume) {
      resolvedResume = resume
    } else {
      return NextResponse.json({ error: "No resume data" }, { status: 400 })
    }

    // If jobId is provided, generate optimization report for that specific job
    if (jobId) {
      const job = jobs.find((j) => j.id === jobId)
      if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })
      const report = generateOptimizationReport(resolvedResume, job)
      return NextResponse.json({ report, job })
    }

    // Rule-based matching first (fast, always works, < 50ms)
    const results = matchResumeToJobs(resolvedResume, jobs)

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
          result.aiAnalysis = aiResult.analysis
          result.score = Math.round((result.score + aiResult.score) / 2)
          result.matchedSkills = aiResult.skillMatch.matched.length > 0
            ? aiResult.skillMatch.matched
            : result.matchedSkills
          result.missingSkills = aiResult.skillMatch.missing.length > 0
            ? aiResult.skillMatch.missing
            : result.missingSkills
          result.suggestions = aiResult.suggestions.length > 0
            ? aiResult.suggestions
            : result.suggestions
          result.aiPowered = true
        }
      }
    } catch (err) {
      console.warn("AI enrichment failed, using rule-based results:", err)
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error("Match error:", error)
    return NextResponse.json({ error: "Failed to match" }, { status: 500 })
  }
}
