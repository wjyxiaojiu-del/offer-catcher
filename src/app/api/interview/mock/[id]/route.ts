/**
 * 单个模拟面试 API
 * GET /api/interview/mock/[id] - 获取面试详情
 * PUT /api/interview/mock/[id] - 更新面试
 * DELETE /api/interview/mock/[id] - 删除面试
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-guard'
import { getDeviceIdFromRequest } from '@/lib/api-device'
import { getMockInterview, updateMockInterview, deleteMockInterview } from '@/lib/interview/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireApiAccess(req, { rateLimitKind: 'general' })
  if (guard) return guard

  try {
    const { id } = await params
    const deviceId = getDeviceIdFromRequest(req) || 'legacy'
    const interview = await getMockInterview(deviceId, id)

    if (!interview) {
      return NextResponse.json({ error: '面试不存在' }, { status: 404 })
    }

    return NextResponse.json(interview)
  } catch (error) {
    console.error('获取面试详情失败:', error)
    return NextResponse.json(
      { error: '获取面试详情失败' },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireApiAccess(req, { rateLimitKind: 'general' })
  if (guard) return guard

  try {
    const { id } = await params
    const body = await req.json()
    const deviceId = getDeviceIdFromRequest(req) || 'legacy'
    const interview = await updateMockInterview(deviceId, id, body)
    return NextResponse.json(interview)
  } catch (error) {
    console.error('更新面试失败:', error)
    return NextResponse.json(
      { error: '更新面试失败' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireApiAccess(req, { rateLimitKind: 'general' })
  if (guard) return guard

  try {
    const { id } = await params
    const deviceId = getDeviceIdFromRequest(req) || 'legacy'
    await deleteMockInterview(deviceId, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除面试失败:', error)
    return NextResponse.json(
      { error: '删除面试失败' },
      { status: 500 }
    )
  }
}
