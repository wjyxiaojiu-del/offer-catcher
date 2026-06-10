/**
 * 重点题标记 API
 * GET /api/interview/flags - 获取所有标记的题目ID
 * PUT /api/interview/flags - 切换标记状态
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-guard'
import { getDeviceIdFromRequest } from '@/lib/api-device'
import { getAllFlaggedQuestionIds, toggleFlag } from '@/lib/interview/db'

export async function GET(req: NextRequest) {
  const guard = requireApiAccess(req, { rateLimitKind: 'general' })
  if (guard) return guard

  try {
    const deviceId = getDeviceIdFromRequest(req) || 'legacy'
    const ids = await getAllFlaggedQuestionIds(deviceId)
    return NextResponse.json(ids)
  } catch (error) {
    console.error('获取标记失败:', error)
    return NextResponse.json(
      { error: '获取标记失败' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  const guard = requireApiAccess(req, { rateLimitKind: 'general' })
  if (guard) return guard

  try {
    const { questionId } = await req.json()

    if (!questionId) {
      return NextResponse.json(
        { error: '缺少 questionId' },
        { status: 400 }
      )
    }

    const deviceId = getDeviceIdFromRequest(req) || 'legacy'
    const result = await toggleFlag(deviceId, questionId)
    return NextResponse.json(result)
  } catch (error) {
    console.error('切换标记失败:', error)
    return NextResponse.json(
      { error: '切换标记失败' },
      { status: 500 }
    )
  }
}
