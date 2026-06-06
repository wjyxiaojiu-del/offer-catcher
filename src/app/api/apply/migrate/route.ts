import { NextResponse } from "next/server"
import type { Application } from "@/types"
import { apiError } from "@/lib/api-response"
import { requireApiAccess } from "@/lib/api-guard"

export async function POST(req: Request) {
  const authError = requireApiAccess(req)
  if (authError) return authError

  try {
    const { applications }: { applications: Application[] } = await req.json()
    if (!Array.isArray(applications) || applications.length === 0) {
      return NextResponse.json({ migrated: 0 })
    }

    try {
      const { prisma } = await import("@/lib/db")

      // Skip records that already exist (by id)
      const existing = await prisma.application.findMany({
        where: { id: { in: applications.map(a => a.id) } },
        select: { id: true },
      })
      const existingIds = new Set(existing.map(e => e.id))
      const toInsert = applications.filter(a => !existingIds.has(a.id))

      if (toInsert.length === 0) {
        return NextResponse.json({ migrated: 0, skipped: applications.length })
      }

      await prisma.application.createMany({
        data: toInsert.map(a => ({
          id: a.id,
          jobId: a.jobId,
          jobSnapshot: JSON.stringify(a.jobSnapshot),
          matchScore: a.score || 0,
          status: a.status,
          method: a.method,
          appliedAt: new Date(a.appliedAt),
        })),
      })

      return NextResponse.json({ migrated: toInsert.length, skipped: existingIds.size })
    } catch (dbErr) {
      console.warn("Migration DB error:", dbErr)
      return apiError("数据库不可用", "DB_UNAVAILABLE", 503)
    }
  } catch (err) {
    console.error("Migration error:", err)
    return apiError("迁移失败", "MIGRATE_ERROR", 500)
  }
}
