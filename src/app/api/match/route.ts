import { NextResponse } from "next/server"
import { matchResumeToJobs, generateOptimizationReport } from "@/lib/matcher"
import { jobs } from "@/data/jobs"

export async function POST(req: Request) {
  try {
    const { resume, jobId } = await req.json()
    if (!resume) return NextResponse.json({ error: "No resume data" }, { status: 400 })

    // If jobId is provided, generate optimization report for that specific job
    if (jobId) {
      const job = jobs.find(j => j.id === jobId)
      if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })
      const report = generateOptimizationReport(resume, job)
      return NextResponse.json({ report, job })
    }

    // Rule-based matching first (fast, always works)
    const results = matchResumeToJobs(resume, jobs)

    // Enrich top 5 results with AI analysis (parallel, non-blocking)
    try {
      const { aiAnalyzeMatch } = await import("@/lib/ai")
      const topResults = results.slice(0, 5)

      const aiAnalyses = await Promise.allSettled(
        topResults.map(result =>
          aiAnalyzeMatch(resume, {
            title: result.job.title,
            company: result.job.company,
            description: result.job.description,
            requirements: result.job.requirements,
            skills: result.job.skills,
            education: result.job.education,
            experience: result.job.experience,
          })
        )
      )

      // Merge AI results into match results
      for (let i = 0; i < topResults.length; i++) {
        const aiResult = aiAnalyses[i]
        if (aiResult.status === "fulfilled") {
          const ai = aiResult.value
          topResults[i].aiAnalysis = ai.analysis
          topResults[i].score = Math.round((topResults[i].score + ai.score) / 2) // Blend rule + AI scores
          topResults[i].matchedSkills = ai.skillMatch.matched.length > 0 ? ai.skillMatch.matched : topResults[i].matchedSkills
          topResults[i].missingSkills = ai.skillMatch.missing.length > 0 ? ai.skillMatch.missing : topResults[i].missingSkills
          topResults[i].suggestions = ai.suggestions.length > 0 ? ai.suggestions : topResults[i].suggestions
          topResults[i].aiPowered = true
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
