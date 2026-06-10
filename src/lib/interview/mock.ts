/**
 * 模拟面试逻辑
 * 复用 offer-catcher 的 LLM 层实现面试对话
 */

import { callLLM } from '@/lib/ai'

// ========== 面试计划生成 ==========

export interface InterviewPlan {
  summary: string
  focusAreas: string[]
  sections: Array<{
    name: string
    description: string
    questionCount: number
  }>
  openingQuestion: string
}

export async function generateInterviewPlan(params: {
  jobTitle: string
  jobLevel?: string
  jdText?: string
  resumeText?: string
}): Promise<InterviewPlan> {
  const systemPrompt = `你是一位资深技术面试官。请根据以下信息生成面试计划。

目标岗位：${params.jobTitle}
${params.jobLevel ? `级别：${params.jobLevel}` : ''}
${params.jdText ? `岗位描述：\n${params.jdText}` : ''}
${params.resumeText ? `候选人简历：\n${params.resumeText}` : ''}

请生成 JSON 格式的面试计划，包含：
1. summary: 面试概述（1-2句话）
2. focusAreas: 重点考察领域（3-5个）
3. sections: 面试环节（3-5个），每个环节包含 name、description、questionCount
4. openingQuestion: 开场问题

只返回 JSON，不要其他内容。`

  const userPrompt = '请生成面试计划。'

  try {
    const response = await callLLM(systemPrompt, userPrompt)
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('生成面试计划失败:', e)
  }

  // 默认计划
  return {
    summary: `针对${params.jobTitle}岗位的技术面试`,
    focusAreas: ['基础知识', '项目经验', '问题解决能力'],
    sections: [
      { name: '自我介绍', description: '请简要介绍自己', questionCount: 1 },
      { name: '技术基础', description: '考察核心技术知识', questionCount: 3 },
      { name: '项目经验', description: '深入了解项目经验', questionCount: 2 },
      { name: '场景题', description: '实际问题解决能力', questionCount: 2 },
    ],
    openingQuestion: '请先简单介绍一下你自己，以及你为什么对这个岗位感兴趣？',
  }
}

// ========== 面试对话 ==========

export interface InterviewTurn {
  role: 'interviewer' | 'candidate'
  content: string
  timestamp: string
}

export interface InterviewerResponse {
  action: 'follow_up' | 'next_question' | 'complete'
  question: string
  feedback?: string
}

export async function generateInterviewerResponse(
  turns: InterviewTurn[],
  plan: InterviewPlan
): Promise<InterviewerResponse> {
  const conversationHistory = turns
    .map((t) => `${t.role === 'interviewer' ? '面试官' : '候选人'}：${t.content}`)
    .join('\n\n')

  const systemPrompt = `你是一位资深技术面试官，正在进行一场技术面试。

面试计划：
${JSON.stringify(plan, null, 2)}

对话历史：
${conversationHistory}

根据候选人的回答，决定下一步：
1. 如果回答不够深入，使用 follow_up 追问
2. 如果当前问题已充分回答，使用 next_question 进入下一个问题
3. 如果面试时间已到或所有环节已完成，使用 complete 结束面试

请返回 JSON 格式：
{
  "action": "follow_up|next_question|complete",
  "question": "你的问题或追问",
  "feedback": "可选：对候选人回答的简短反馈"
}

只返回 JSON，不要其他内容。`

  const userPrompt = '请根据对话历史，生成下一个面试问题或结束面试。'

  try {
    const response = await callLLM(systemPrompt, userPrompt)
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('生成面试回复失败:', e)
  }

  // 默认回复
  return {
    action: 'next_question',
    question: '请继续回答下一个问题。',
  }
}

// ========== 面试复盘报告 ==========

export interface InterviewReport {
  overallScore: number
  summary: string
  dimensions: Array<{
    name: string
    score: number
    comment: string
  }>
  strengths: string[]
  improvements: string[]
  recommendedQuestions: string[]
}

export async function generateInterviewReport(
  turns: InterviewTurn[],
  plan: InterviewPlan
): Promise<InterviewReport> {
  const conversationHistory = turns
    .map((t) => `${t.role === 'interviewer' ? '面试官' : '候选人'}：${t.content}`)
    .join('\n\n')

  const systemPrompt = `你是一位资深技术面试官，请根据以下面试对话生成详细的复盘报告。

面试计划：
${JSON.stringify(plan, null, 2)}

面试对话：
${conversationHistory}

请生成 JSON 格式的复盘报告，包含：
1. overallScore: 总体评分（0-100）
2. summary: 总体评价（2-3句话）
3. dimensions: 各维度评分，每个维度包含 name、score（0-100）、comment
   - 技术准确性
   - 项目深度
   - 表达结构
   - 岗位匹配度
   - 追问稳定性
4. strengths: 做得好的地方（3-5条）
5. improvements: 需要改进的地方（3-5条）
6. recommendedQuestions: 推荐练习的面试题（3-5个题目名称）

只返回 JSON，不要其他内容。`

  const userPrompt = '请生成面试复盘报告。'

  try {
    const response = await callLLM(systemPrompt, userPrompt)
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('生成复盘报告失败:', e)
  }

  // 默认报告
  return {
    overallScore: 70,
    summary: '面试表现中等，有提升空间。',
    dimensions: [
      { name: '技术准确性', score: 70, comment: '基础知识掌握尚可' },
      { name: '项目深度', score: 65, comment: '项目描述需要更深入' },
      { name: '表达结构', score: 75, comment: '表达较为清晰' },
      { name: '岗位匹配度', score: 70, comment: '技能与岗位要求基本匹配' },
      { name: '追问稳定性', score: 68, comment: '追问时有些紧张' },
    ],
    strengths: ['回答问题有条理', '基础知识扎实'],
    improvements: ['需要更深入的项目经验', '追问时可以更自信'],
    recommendedQuestions: [],
  }
}

// ========== 答题批改 ==========

export interface AnswerFeedback {
  conclusion: string
  goodPoints: string[]
  missingPoints: string[]
  improvedAnswer: string
}

export async function generateAnswerFeedback(
  question: string,
  referenceAnswer: string,
  userAnswer: string
): Promise<AnswerFeedback> {
  const systemPrompt = `你是一位技术面试教练，请对比参考答案和用户的自测作答，给出反馈。

题目：${question}

参考答案：
${referenceAnswer}

用户的自测作答：
${userAnswer}

请生成 JSON 格式的反馈：
1. conclusion: 总体结论（做得好/需要改进/需要重新学习）
2. goodPoints: 做得好的地方（1-3条）
3. missingPoints: 需要补齐的内容（1-3条）
4. improvedAnswer: 面试版优化回答（基于用户答案改进，保留用户思路）

只返回 JSON，不要其他内容。`

  const userPrompt = '请批改作答。'

  try {
    const response = await callLLM(systemPrompt, userPrompt)
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('生成答题反馈失败:', e)
  }

  return {
    conclusion: '需要改进',
    goodPoints: ['尝试回答了问题'],
    missingPoints: ['答案不够完整'],
    improvedAnswer: referenceAnswer,
  }
}
