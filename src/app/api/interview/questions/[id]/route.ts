/**
 * 单个面试题目 API
 * GET /api/interview/questions/[id] - 获取题目详情
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-guard'
import { getDeviceIdFromRequest } from '@/lib/api-device'
import { getQuestionById } from '@/lib/interview/db'
import { apiError } from '@/lib/api-response'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireApiAccess(req, { rateLimitKind: 'general' })
  if (guard) return guard

  try {
    const { id } = await params
    const deviceId = getDeviceIdFromRequest(req) || 'legacy'
    const question = await getQuestionById(id, deviceId)

    if (!question) {
      return apiError('题目不存在', 'NOT_FOUND', 404)
    }

    return NextResponse.json(question)
  } catch (error) {
    console.error('获取题目详情失败:', error)
    return apiError('获取题目详情失败', 'GET_ERROR', 500)
  }
}
