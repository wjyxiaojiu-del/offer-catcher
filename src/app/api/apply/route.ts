import { NextResponse } from "next/server"
import { jobs } from "@/data/jobs"
import type { Application, ApplicationMethod } from "@/types"
import { apiError } from "@/lib/api-response"
import { requireApiAccess } from "@/lib/api-guard"

function toDisplayMethod(m: string): ApplicationMethod {
  if (m === "手动投递" || m === "自动投递" || m === "BOSS自动投递") return m
  if (m === "manual" || m === "手动") return "手动投递"
  if (m === "auto" || m === "自动") return "自动投递"
  if (m === "boss_auto" || m === "boss") return "BOSS自动投递"
  return "手动投递"
}

// In-memory store (fallback when DB unavailable)
const applications: Map<string, Application> = new Map()

export async function POST(req: Request) {
  const authError = requireApiAccess(req)
  if (authError) return authError

  try {
    const { jobId, resumeId }: { jobId: string; resumeId?: string } = await req.json()
    const job = jobs.find(j => j.id === jobId)
    if (!job) return apiError("岗位不存在", "JOB_NOT_FOUND", 404)

    const appData: Application = {
      id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      jobId: job.id,
      jobSnapshot: {
        title: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary,
      },
      status: "已投递",
      appliedAt: new Date().toISOString(),
      method: "手动投递",
    }

    // Persist to DB (graceful fallback)
    try {
      const { prisma } = await import("@/lib/db")
      await prisma.application.create({
        data: {
          id: appData.id,
          resumeId: resumeId || null,
          jobId: appData.jobId,
          jobSnapshot: JSON.stringify(appData.jobSnapshot),
          status: appData.status,
          method: appData.method,
          appliedAt: new Date(appData.appliedAt),
        },
      })
    } catch (dbErr) {
      console.warn("DB application save failed:", dbErr)
    }

    // Always keep in-memory as fallback
    applications.set(appData.id, appData)

    return NextResponse.json({ success: true, application: appData })
  } catch (error) {
    return apiError("投递失败", "APPLY_ERROR", 500)
  }
}

export async function GET(req: Request) {
  const authError = requireApiAccess(req)
  if (authError) return authError

  // Try DB first, fallback to memory
  try {
    const { prisma } = await import("@/lib/db")
    const dbApps = await prisma.application.findMany({ orderBy: { appliedAt: "desc" } })
    const apps: Application[] = dbApps.map(a => {
      let snapshot: Application["jobSnapshot"] = undefined
      try {
        if (a.jobSnapshot) {
          snapshot = JSON.parse(a.jobSnapshot)
        }
      } catch {
        // ignore parse error
      }
      return {
        id: a.id,
        jobId: a.jobId || "",
        jobSnapshot: snapshot,
        score: a.matchScore ? Math.round(a.matchScore) : undefined,
        status: a.status as Application["status"],
        appliedAt: a.appliedAt.toISOString(),
        method: toDisplayMethod(a.method),
        resumeId: a.resumeId || undefined,
      }
    })
    return NextResponse.json({ applications: apps })
  } catch {
    const allApps = Array.from(applications.values())
    return NextResponse.json({ applications: allApps })
  }
}
