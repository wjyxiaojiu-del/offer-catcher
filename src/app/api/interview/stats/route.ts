/**
 * 面试统计 API
 * GET /api/interview/stats - 获取统计数据
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-guard'
import { getDeviceIdFromRequest } from '@/lib/api-device'
import { getInterviewStats } from '@/lib/interview/db'

export async function GET(req: NextRequest) {
  const guard = requireApiAccess(req, { rateLimitKind: 'general' })
  if (guard) return guard

  try {
    const deviceId = getDeviceIdFromRequest(req) || 'legacy'
    const stats = await getInterviewStats(deviceId)
    return NextResponse.json(stats)
  } catch (error) {
    console.error('获取统计数据失败:', error)
    return NextResponse.json(
      { error: '获取统计数据失败' },
      { status: 500 }
    )
  }
}
