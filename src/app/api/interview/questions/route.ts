/**
 * 面试题目 API
 * GET /api/interview/questions - 获取题目列表
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-guard'
import { getDeviceIdFromRequest } from '@/lib/api-device'
import { getQuestions, getAllModules } from '@/lib/interview/db'

export async function GET(req: NextRequest) {
  const guard = requireApiAccess(req, { rateLimitKind: 'general' })
  if (guard) return guard

  try {
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '30')
    const moduleFilter = searchParams.get('module') || undefined
    const difficulty = searchParams.get('difficulty')
      ? parseInt(searchParams.get('difficulty')!)
      : undefined
    const status = searchParams.get('status') || undefined
    const starred = searchParams.get('starred') === 'true'
    const hasNotes = searchParams.get('hasNotes') === 'true'
    const search = searchParams.get('search') || undefined

    const deviceId = getDeviceIdFromRequest(req) || 'legacy'
    const result = await getQuestions(
      deviceId,
      { module: moduleFilter, difficulty, status, starred, hasNotes, search },
      page,
      pageSize
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('获取题目列表失败:', error)
    return NextResponse.json(
      { error: '获取题目列表失败' },
      { status: 500 }
    )
  }
}
