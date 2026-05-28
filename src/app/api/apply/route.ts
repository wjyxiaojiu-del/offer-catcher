import { NextResponse } from "next/server"
import { jobs } from "@/data/jobs"

// In-memory store (resets on server restart, but fine for demo)
const applications: Map<string, any> = new Map()

export async function POST(req: Request) {
  try {
    const { jobId, resumeName } = await req.json()
    const job = jobs.find(j => j.id === jobId)
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

    const application = {
      id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      location: job.location,
      salary: job.salary,
      status: "已投递",
      appliedAt: new Date().toISOString(),
      resumeName: resumeName || "匿名",
      method: "手动投递"
    }

    applications.set(application.id, application)

    return NextResponse.json({ success: true, application })
  } catch (error) {
    return NextResponse.json({ error: "Failed to apply" }, { status: 500 })
  }
}

export async function GET() {
  const allApps = Array.from(applications.values())
  return NextResponse.json({ applications: allApps })
}
