/**
 * 模拟面试对话 API (SSE 流式)
 * POST /api/interview/mock/chat - 发送面试消息
 */

import { NextRequest } from 'next/server'
import { requireApiAccess } from '@/lib/api-guard'
import { getDeviceIdFromRequest } from '@/lib/api-device'
import {
  generateInterviewPlan,
  generateInterviewerResponse,
  generateInterviewReport,
  type InterviewTurn,
  type InterviewPlan,
} from '@/lib/interview/mock'
import { updateMockInterview, getMockInterview } from '@/lib/interview/db'

export async function POST(req: NextRequest) {
  const guard = requireApiAccess(req, { rateLimitKind: 'ai' })
  if (guard) return guard

  try {
    const body = await req.json()
    const { interviewId, action, message } = body

    if (!interviewId || !action) {
      return new Response(
        JSON.stringify({ error: '缺少 interviewId 或 action' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const deviceId = getDeviceIdFromRequest(req) || 'legacy'

    // 获取面试记录
    const interview = await getMockInterview(deviceId, interviewId)
    if (!interview) {
      return new Response(
        JSON.stringify({ error: '面试不存在' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // SSE 流式响应
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (type: string, data: Record<string, unknown> = {}) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`)
          )
        }

        try {
          // 解析现有数据
          const turns: InterviewTurn[] = JSON.parse(interview.turns || '[]')
          let plan: InterviewPlan | null = interview.plan
            ? JSON.parse(interview.plan)
            : null

          if (action === 'start') {
            // 生成面试计划
            sendEvent('thinking', { content: '正在生成面试计划...' })

            plan = await generateInterviewPlan({
              jobTitle: interview.jobTitle || '技术岗位',
              jobLevel: interview.jobLevel || undefined,
              jdText: interview.jdText || undefined,
              resumeText: interview.resumeText || undefined,
            })

            // 更新面试记录
            await updateMockInterview(deviceId, interviewId, {
              status: 'interviewing',
              plan: JSON.stringify(plan),
            })

            sendEvent('plan', { plan })
            sendEvent('question', {
              content: plan.openingQuestion,
              action: 'next_question',
            })
          } else if (action === 'answer') {
            // 候选人回答
            if (!message) {
              sendEvent('error', { content: '缺少回答内容' })
              controller.close()
              return
            }

            turns.push({
              role: 'candidate',
              content: message,
              timestamp: new Date().toISOString(),
            })

            sendEvent('thinking', { content: '正在思考下一个问题...' })

            // 生成面试官回复
            const response = await generateInterviewerResponse(
              turns,
              plan!
            )

            turns.push({
              role: 'interviewer',
              content: response.question,
              timestamp: new Date().toISOString(),
            })

            // 更新面试记录
            await updateMockInterview(deviceId, interviewId, {
              turns: JSON.stringify(turns),
            })

            if (response.action === 'complete') {
              sendEvent('complete', {
                content: response.question,
                feedback: response.feedback,
              })
            } else {
              sendEvent('question', {
                content: response.question,
                action: response.action,
                feedback: response.feedback,
              })
            }
          } else if (action === 'end') {
            // 结束面试，生成复盘报告
            sendEvent('thinking', { content: '正在生成复盘报告...' })

            const report = await generateInterviewReport(turns, plan!)

            // 更新面试记录
            await updateMockInterview(deviceId, interviewId, {
              status: 'completed',
              turns: JSON.stringify(turns),
              report: JSON.stringify(report),
              score: report.overallScore,
            })

            sendEvent('report', { report })
          } else if (action === 'clarify') {
            // 澄清题意
            sendEvent('clarify', {
              content: '让我换一种方式来问这个问题。',
            })
          } else if (action === 'repeat') {
            // 重复问题
            const lastInterviewerTurn = [...turns]
              .reverse()
              .find((t) => t.role === 'interviewer')

            if (lastInterviewerTurn) {
              sendEvent('question', {
                content: lastInterviewerTurn.content,
                action: 'repeat',
              })
            }
          }

          controller.close()
        } catch (error) {
          console.error('面试对话错误:', error)
          sendEvent('error', {
            content: '处理失败，请重试',
          })
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('面试对话API错误:', error)
    return new Response(
      JSON.stringify({ error: '服务器错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
