/**
 * 学习进度 API
 * GET /api/interview/progress - 获取所有学习记录
 * PUT /api/interview/progress - 更新学习状态
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-guard'
import { getDeviceIdFromRequest } from '@/lib/api-device'
import { getAllStudyRecords, updateStudyRecord, bulkUpdateStudyRecords } from '@/lib/interview/db'

export async function GET(req: NextRequest) {
  const guard = requireApiAccess(req, { rateLimitKind: 'general' })
  if (guard) return guard

  try {
    const deviceId = getDeviceIdFromRequest(req) || 'legacy'
    const records = await getAllStudyRecords(deviceId)
    return NextResponse.json(records)
  } catch (error) {
    console.error('获取学习记录失败:', error)
    return NextResponse.json(
      { error: '获取学习记录失败' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  const guard = requireApiAccess(req, { rateLimitKind: 'general' })
  if (guard) return guard

  try {
    const body = await req.json()
    const deviceId = getDeviceIdFromRequest(req) || 'legacy'

    // 批量更新
    if (Array.isArray(body.updates)) {
      const results = await bulkUpdateStudyRecords(deviceId, body.updates)
      return NextResponse.json(results)
    }

    // 单个更新
    const { questionId, status } = body
    if (!questionId || !status) {
      return NextResponse.json(
        { error: '缺少 questionId 或 status' },
        { status: 400 }
      )
    }

    const result = await updateStudyRecord(deviceId, questionId, status)
    return NextResponse.json(result)
  } catch (error) {
    console.error('更新学习记录失败:', error)
    return NextResponse.json(
      { error: '更新学习记录失败' },
      { status: 500 }
    )
  }
}
