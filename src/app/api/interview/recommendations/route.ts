/**
 * 每日推荐 API
 * GET /api/interview/recommendations - 获取推荐题目
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-guard'
import { getDeviceIdFromRequest } from '@/lib/api-device'
import { getDailyRecommendations } from '@/lib/interview/db'

export async function GET(req: NextRequest) {
  const guard = requireApiAccess(req, { rateLimitKind: 'general' })
  if (guard) return guard

  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    const deviceId = getDeviceIdFromRequest(req) || 'legacy'
    const recommendations = await getDailyRecommendations(deviceId, limit)
    return NextResponse.json(recommendations)
  } catch (error) {
    console.error('获取推荐失败:', error)
    return NextResponse.json(
      { error: '获取推荐失败' },
      { status: 500 }
    )
  }
}
