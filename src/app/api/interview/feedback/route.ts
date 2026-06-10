/**
 * 答题批改 API
 * POST /api/interview/feedback - 获取AI批改反馈
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-guard'
import { generateAnswerFeedback } from '@/lib/interview/mock'

export async function POST(req: NextRequest) {
  const guard = requireApiAccess(req, { rateLimitKind: 'ai' })
  if (guard) return guard

  try {
    const { question, referenceAnswer, userAnswer } = await req.json()

    if (!question || !referenceAnswer || !userAnswer) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    const feedback = await generateAnswerFeedback(
      question,
      referenceAnswer,
      userAnswer
    )

    return NextResponse.json(feedback)
  } catch (error) {
    console.error('获取批改反馈失败:', error)
    return NextResponse.json(
      { error: '获取批改反馈失败' },
      { status: 500 }
    )
  }
}
