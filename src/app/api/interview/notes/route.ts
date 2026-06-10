/**
 * 面试笔记 API
 * GET /api/interview/notes - 获取所有笔记
 * PUT /api/interview/notes - 创建/更新笔记
 * DELETE /api/interview/notes - 删除笔记
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-guard'
import { getDeviceIdFromRequest } from '@/lib/api-device'
import { getAllNotes, upsertNote, deleteNote } from '@/lib/interview/db'

export async function GET(req: NextRequest) {
  const guard = requireApiAccess(req, { rateLimitKind: 'general' })
  if (guard) return guard

  try {
    const deviceId = getDeviceIdFromRequest(req) || 'legacy'
    const notes = await getAllNotes(deviceId)
    return NextResponse.json(notes)
  } catch (error) {
    console.error('获取笔记失败:', error)
    return NextResponse.json(
      { error: '获取笔记失败' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  const guard = requireApiAccess(req, { rateLimitKind: 'general' })
  if (guard) return guard

  try {
    const { questionId, content } = await req.json()

    if (!questionId || content === undefined) {
      return NextResponse.json(
        { error: '缺少 questionId 或 content' },
        { status: 400 }
      )
    }

    const deviceId = getDeviceIdFromRequest(req) || 'legacy'
    const note = await upsertNote(deviceId, questionId, content)
    return NextResponse.json(note)
  } catch (error) {
    console.error('保存笔记失败:', error)
    return NextResponse.json(
      { error: '保存笔记失败' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
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
    await deleteNote(deviceId, questionId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除笔记失败:', error)
    return NextResponse.json(
      { error: '删除笔记失败' },
      { status: 500 }
    )
  }
}
