/**
 * 模拟面试 API
 * GET /api/interview/mock - 获取面试列表
 * POST /api/interview/mock - 创建面试会话
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-guard'
import { getDeviceIdFromRequest } from '@/lib/api-device'
import { getMockInterviews, createMockInterview } from '@/lib/interview/db'

export async function GET(req: NextRequest) {
  const guard = requireApiAccess(req, { rateLimitKind: 'general' })
  if (guard) return guard

  try {
    const deviceId = getDeviceIdFromRequest(req) || 'legacy'
    const interviews = await getMockInterviews(deviceId)
    return NextResponse.json(interviews)
  } catch (error) {
    console.error('获取面试列表失败:', error)
    return NextResponse.json(
      { error: '获取面试列表失败' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const guard = requireApiAccess(req, { rateLimitKind: 'ai' })
  if (guard) return guard

  try {
    const body = await req.json()
    const deviceId = getDeviceIdFromRequest(req) || 'legacy'
    const interview = await createMockInterview(deviceId, {
      jobTitle: body.jobTitle,
      jobLevel: body.jobLevel,
      jdText: body.jdText,
      resumeText: body.resumeText,
    })
    return NextResponse.json(interview)
  } catch (error) {
    console.error('创建面试失败:', error)
    return NextResponse.json(
      { error: '创建面试失败' },
      { status: 500 }
    )
  }
}
