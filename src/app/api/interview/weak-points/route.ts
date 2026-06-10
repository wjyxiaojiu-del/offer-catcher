/**
 * 薄弱点分析 API
 * GET /api/interview/weak-points - 获取薄弱点
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-guard'
import { getDeviceIdFromRequest } from '@/lib/api-device'
import { getWeakPoints } from '@/lib/interview/db'

export async function GET(req: NextRequest) {
  const guard = requireApiAccess(req, { rateLimitKind: 'general' })
  if (guard) return guard

  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '20')

    const deviceId = getDeviceIdFromRequest(req) || 'legacy'
    const weakPoints = await getWeakPoints(deviceId, limit)
    return NextResponse.json(weakPoints)
  } catch (error) {
    console.error('获取薄弱点失败:', error)
    return NextResponse.json(
      { error: '获取薄弱点失败' },
      { status: 500 }
    )
  }
}
