/**
 * 面试模块数据操作层（deviceId 隔离版）
 * 封装面试相关的 Prisma 数据库操作
 */

import { prisma } from '@/lib/db'
import type {
  InterviewQuestion,
  InterviewStudyRecord,
  InterviewNote,
  InterviewFlag,
  MockInterview,
} from '@prisma/client'

// ========== 题目查询 ==========

export interface QuestionFilters {
  module?: string
  difficulty?: number
  status?: string // study record status
  starred?: boolean
  hasNotes?: boolean
  search?: string
  source?: string
}

export interface PaginatedQuestions {
  questions: InterviewQuestion[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function getQuestions(
  deviceId: string,
  filters: QuestionFilters = {},
  page = 1,
  pageSize = 30
): Promise<PaginatedQuestions> {
  const where: Record<string, unknown> = {}

  if (filters.module) {
    where.module = filters.module
  }
  if (filters.difficulty) {
    where.difficulty = filters.difficulty
  }
  if (filters.source) {
    where.source = filters.source
  }
  if (filters.search) {
    where.OR = [
      { question: { contains: filters.search } },
      { tags: { contains: filters.search } },
      { module: { contains: filters.search } },
    ]
  }
  if (filters.starred) {
    where.flags = { some: { deviceId, starred: true } }
  }
  if (filters.hasNotes) {
    where.notes = { some: { deviceId } }
  }
  if (filters.status) {
    where.studyRecords = { some: { deviceId, status: filters.status } }
  }

  const [questions, total] = await Promise.all([
    prisma.interviewQuestion.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { id: 'asc' },
    }),
    prisma.interviewQuestion.count({ where }),
  ])

  return {
    questions,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function getQuestionById(id: string, deviceId: string) {
  return prisma.interviewQuestion.findUnique({
    where: { id },
    include: {
      studyRecords: { where: { deviceId } },
      notes: { where: { deviceId } },
      flags: { where: { deviceId } },
    },
  })
}

export async function getQuestionsByModule(module: string) {
  return prisma.interviewQuestion.findMany({
    where: { module },
    orderBy: { difficulty: 'asc' },
  })
}

export async function getAllModules() {
  const modules = await prisma.interviewQuestion.groupBy({
    by: ['module'],
    _count: { id: true },
    orderBy: { module: 'asc' },
  })
  return modules.map((m) => ({
    name: m.module,
    count: m._count.id,
  }))
}

// ========== 学习进度 ==========

export async function getStudyRecord(deviceId: string, questionId: string) {
  return prisma.interviewStudyRecord.findFirst({
    where: { deviceId, questionId },
  })
}

export async function getAllStudyRecords(deviceId: string) {
  return prisma.interviewStudyRecord.findMany({
    where: { deviceId },
  })
}

export async function updateStudyRecord(
  deviceId: string,
  questionId: string,
  status: 'unlearned' | 'mastered' | 'review'
) {
  return prisma.interviewStudyRecord.upsert({
    where: { deviceId_questionId: { deviceId, questionId } },
    update: {
      status,
      lastUpdated: new Date(),
      reviewCount: { increment: 1 },
    },
    create: {
      deviceId,
      questionId,
      status,
      reviewCount: 1,
    },
  })
}

export async function bulkUpdateStudyRecords(
  deviceId: string,
  updates: Array<{ questionId: string; status: string }>
) {
  const results = []
  for (const update of updates) {
    const result = await prisma.interviewStudyRecord.upsert({
      where: { deviceId_questionId: { deviceId, questionId: update.questionId } },
      update: {
        status: update.status,
        lastUpdated: new Date(),
        reviewCount: { increment: 1 },
      },
      create: {
        deviceId,
        questionId: update.questionId,
        status: update.status,
        reviewCount: 1,
      },
    })
    results.push(result)
  }
  return results
}

// ========== 笔记 ==========

export async function getNote(deviceId: string, questionId: string) {
  return prisma.interviewNote.findFirst({
    where: { deviceId, questionId },
  })
}

export async function getAllNotes(deviceId: string) {
  return prisma.interviewNote.findMany({
    where: { deviceId },
    orderBy: { updatedAt: 'desc' },
    include: {
      question: {
        select: { id: true, question: true, module: true },
      },
    },
  })
}

export async function getRecentNotes(deviceId: string, limit = 4) {
  return prisma.interviewNote.findMany({
    where: { deviceId },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    include: {
      question: {
        select: { id: true, question: true, module: true },
      },
    },
  })
}

export async function upsertNote(deviceId: string, questionId: string, content: string) {
  return prisma.interviewNote.upsert({
    where: { deviceId_questionId: { deviceId, questionId } },
    update: {
      content,
      updatedAt: new Date(),
    },
    create: {
      deviceId,
      questionId,
      content,
    },
  })
}

export async function deleteNote(deviceId: string, questionId: string) {
  return prisma.interviewNote.delete({
    where: { deviceId_questionId: { deviceId, questionId } },
  })
}

// ========== 重点题标记 ==========

export async function getFlag(deviceId: string, questionId: string) {
  return prisma.interviewFlag.findFirst({
    where: { deviceId, questionId },
  })
}

export async function toggleFlag(deviceId: string, questionId: string) {
  const existing = await prisma.interviewFlag.findFirst({
    where: { deviceId, questionId },
  })

  if (existing) {
    if (existing.starred) {
      await prisma.interviewFlag.delete({ where: { id: existing.id } })
      return null
    }
    return prisma.interviewFlag.update({
      where: { id: existing.id },
      data: { starred: true, updatedAt: new Date() },
    })
  }

  return prisma.interviewFlag.create({
    data: { deviceId, questionId, starred: true },
  })
}

export async function getAllFlaggedQuestionIds(deviceId: string) {
  const flags = await prisma.interviewFlag.findMany({
    where: { deviceId, starred: true },
    select: { questionId: true },
  })
  return flags.map((f) => f.questionId)
}

// ========== 模拟面试 ==========

export async function getMockInterviews(deviceId: string) {
  return prisma.mockInterview.findMany({
    where: { deviceId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getMockInterview(deviceId: string, id: string) {
  return prisma.mockInterview.findFirst({
    where: { id, deviceId },
  })
}

export async function createMockInterview(deviceId: string, data: {
  jobTitle?: string
  jobLevel?: string
  jdText?: string
  resumeText?: string
}) {
  return prisma.mockInterview.create({
    data: {
      deviceId,
      status: 'planning',
      ...data,
    },
  })
}

export async function updateMockInterview(
  deviceId: string,
  id: string,
  data: Partial<{
    status: string
    plan: string
    turns: string
    report: string
    score: number
  }>
) {
  const existing = await prisma.mockInterview.findFirst({
    where: { id, deviceId },
  })
  if (!existing) throw new Error('面试不存在')

  return prisma.mockInterview.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  })
}

export async function deleteMockInterview(deviceId: string, id: string) {
  const existing = await prisma.mockInterview.findFirst({
    where: { id, deviceId },
  })
  if (!existing) throw new Error('面试不存在')

  return prisma.mockInterview.delete({
    where: { id },
  })
}

// ========== 统计 ==========

export interface InterviewStats {
  totalQuestions: number
  mastered: number
  review: number
  unlearned: number
  streak: number
  todayReviewed: number
  moduleProgress: Array<{
    module: string
    total: number
    mastered: number
    review: number
    unlearned: number
  }>
}

export async function getInterviewStats(deviceId: string): Promise<InterviewStats> {
  const [totalQuestions, studyRecords, modules] = await Promise.all([
    prisma.interviewQuestion.count(),
    prisma.interviewStudyRecord.findMany({ where: { deviceId } }),
    getAllModules(),
  ])

  const mastered = studyRecords.filter((r) => r.status === 'mastered').length
  const review = studyRecords.filter((r) => r.status === 'review').length
  const unlearned = totalQuestions - mastered - review

  const moduleProgress = await Promise.all(
    modules.map(async (mod) => {
      const moduleQuestions = await prisma.interviewQuestion.findMany({
        where: { module: mod.name },
        select: { id: true },
      })
      const questionIds = moduleQuestions.map((q) => q.id)
      const moduleRecords = studyRecords.filter((r) =>
        questionIds.includes(r.questionId)
      )

      return {
        module: mod.name,
        total: mod.count,
        mastered: moduleRecords.filter((r) => r.status === 'mastered').length,
        review: moduleRecords.filter((r) => r.status === 'review').length,
        unlearned:
          mod.count -
          moduleRecords.filter((r) => r.status === 'mastered').length -
          moduleRecords.filter((r) => r.status === 'review').length,
      }
    })
  )

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayReviewed = studyRecords.filter(
    (r) => r.lastUpdated >= today
  ).length

  let streak = 0
  const sortedDates = Array.from(
    new Set(
      studyRecords
        .map((r) => r.lastUpdated.toISOString().split('T')[0])
        .sort()
        .reverse()
    )
  )

  for (let i = 0; i < sortedDates.length; i++) {
    const expected = new Date(today)
    expected.setDate(expected.getDate() - i)
    const expectedStr = expected.toISOString().split('T')[0]
    if (sortedDates[i] === expectedStr) {
      streak++
    } else {
      break
    }
  }

  return {
    totalQuestions,
    mastered,
    review,
    unlearned,
    streak,
    todayReviewed,
    moduleProgress,
  }
}

// ========== 薄弱点分析 ==========

export interface WeakPoint {
  module: string
  questionId: string
  question: string
  reviewCount: number
  status: string
}

export async function getWeakPoints(deviceId: string, limit = 20): Promise<WeakPoint[]> {
  const weakRecords = await prisma.interviewStudyRecord.findMany({
    where: {
      deviceId,
      OR: [{ status: 'review' }, { status: 'unlearned' }],
    },
    orderBy: { reviewCount: 'desc' },
    take: limit,
    include: {
      question: {
        select: { id: true, question: true, module: true },
      },
    },
  })

  return weakRecords.map((r) => ({
    module: r.question.module,
    questionId: r.questionId,
    question: r.question.question,
    reviewCount: r.reviewCount,
    status: r.status,
  }))
}

// ========== 每日推荐 ==========

export async function getDailyRecommendations(deviceId: string, limit = 10) {
  const reviewQuestions = await prisma.interviewStudyRecord.findMany({
    where: { deviceId, status: 'review' },
    take: limit,
    include: {
      question: true,
    },
  })

  if (reviewQuestions.length >= limit) {
    return reviewQuestions.map((r) => r.question)
  }

  const remaining = limit - reviewQuestions.length
  const learnedIds = (await prisma.interviewStudyRecord.findMany({
    where: { deviceId },
    select: { questionId: true },
  })).map((r) => r.questionId)

  const unlearnedQuestions = await prisma.interviewQuestion.findMany({
    where: {
      id: { notIn: learnedIds },
    },
    take: remaining,
    orderBy: { difficulty: 'asc' },
  })

  return [
    ...reviewQuestions.map((r) => r.question),
    ...unlearnedQuestions,
  ]
}
