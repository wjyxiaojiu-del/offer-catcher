/**
 * 岗位导入 API
 * POST /api/jobs/import - 批量导入岗位
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-guard'
import { saveJobs } from '@/lib/job-service'

export async function POST(req: NextRequest) {
  const guard = requireApiAccess(req, { rateLimitKind: 'general' })
  if (guard) return guard

  try {
    const body = await req.json()

    if (!Array.isArray(body.jobs)) {
      return NextResponse.json(
        { error: '请提供 jobs 数组' },
        { status: 400 }
      )
    }

    const count = await saveJobs(body.jobs)

    return NextResponse.json({
      success: true,
      imported: count,
      total: body.jobs.length,
    })
  } catch (error) {
    console.error('导入岗位失败:', error)
    return NextResponse.json(
      { error: '导入岗位失败' },
      { status: 500 }
    )
  }
}
