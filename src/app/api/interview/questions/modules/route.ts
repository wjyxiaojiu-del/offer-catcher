/**
 * 面试题目模块列表 API
 * GET /api/interview/questions/modules - 获取所有模块
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-guard'
import { getAllModules } from '@/lib/interview/db'

export async function GET(req: NextRequest) {
  const guard = requireApiAccess(req, { rateLimitKind: 'general' })
  if (guard) return guard

  try {
    const modules = await getAllModules()
    return NextResponse.json(modules)
  } catch (error) {
    console.error('获取模块列表失败:', error)
    return NextResponse.json(
      { error: '获取模块列表失败' },
      { status: 500 }
    )
  }
}
