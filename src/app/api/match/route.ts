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

    // Otherwise, match all jobs
    const results = matchResumeToJobs(resume, jobs)
    return NextResponse.json({ results })
  } catch (error) {
    console.error("Match error:", error)
    return NextResponse.json({ error: "Failed to match" }, { status: 500 })
  }
}
