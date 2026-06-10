/**
 * 面试刷题 - 学习仪表盘
 */

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  BookOpen,
  Target,
  TrendingUp,
  Flame,
  ChevronRight,
  Brain,
  Zap,
  Star,
  Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface InterviewStats {
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

interface RecentNote {
  id: string
  questionId: string
  content: string
  updatedAt: string
  question: {
    id: string
    question: string
    module: string
  }
}

// 进度环形图组件
function SegmentedRing({
  mastered,
  review,
  unlearned,
  size = 120,
}: {
  mastered: number
  review: number
  unlearned: number
  size?: number
}) {
  const total = mastered + review + unlearned
  if (total === 0) {
    return (
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-400">0</div>
          <div className="text-xs text-gray-500">题目</div>
        </div>
      </div>
    )
  }

  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const masteredLen = (mastered / total) * circumference
  const reviewLen = (review / total) * circumference
  const unlearnedLen = (unlearned / total) * circumference

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#10b981"
          strokeWidth="8"
          strokeDasharray={`${masteredLen} ${circumference - masteredLen}`}
          strokeDashoffset={0}
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="8"
          strokeDasharray={`${reviewLen} ${circumference - reviewLen}`}
          strokeDashoffset={-masteredLen}
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#6b7280"
          strokeWidth="8"
          strokeDasharray={`${unlearnedLen} ${circumference - unlearnedLen}`}
          strokeDashoffset={-(masteredLen + reviewLen)}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{total}</div>
          <div className="text-xs text-gray-500">题目</div>
        </div>
      </div>
    </div>
  )
}

// 模块进度条
function ModuleProgressBar({
  module,
  total,
  mastered,
  review,
}: {
  module: string
  total: number
  mastered: number
  review: number
}) {
  const masteredPercent = (mastered / total) * 100
  const reviewPercent = (review / total) * 100

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-gray-700">{module}</span>
        <span className="text-gray-500">
          {mastered}/{total}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full flex">
          <div
            className="bg-emerald-500 transition-all"
            style={{ width: `${masteredPercent}%` }}
          />
          <div
            className="bg-amber-400 transition-all"
            style={{ width: `${reviewPercent}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default function InterviewDashboard() {
  const [stats, setStats] = useState<InterviewStats | null>(null)
  const [recentNotes, setRecentNotes] = useState<RecentNote[]>([])
  const [loading, setLoading] = useState(true)
  const [isEmpty, setIsEmpty] = useState(false)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [statsRes, notesRes] = await Promise.all([
        fetch('/api/interview/stats'),
        fetch('/api/interview/notes'),
      ])

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
        setIsEmpty(statsData.totalQuestions === 0)
      }
      if (notesRes.ok) {
        const allNotes = await notesRes.json()
        setRecentNotes(Array.isArray(allNotes) ? allNotes.slice(0, 4) : [])
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  async function seedQuestions() {
    setSeeding(true)
    try {
      const res = await fetch('/api/interview/seed', { method: 'POST' })
      if (res.ok) {
        await loadData()
      } else {
        alert('导入失败，请尝试运行 npm run db:seed')
      }
    } catch (e) {
      alert('导入失败，请尝试运行 npm run db:seed')
    } finally {
      setSeeding(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">面试刷题</h1>
            <p className="text-gray-500 mt-1">
              通过 AI 教练辅助，真正理解每个知识点
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/interview/questions"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              开始刷题
            </Link>
            <Link
              href="/interview/mock"
              className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              模拟面试
            </Link>
          </div>
        </div>

        {/* 空题库引导 */}
        {isEmpty && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
            <BookOpen className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-amber-900 mb-2">
              题库为空，请先导入面试题目
            </h3>
            <p className="text-sm text-amber-700 mb-4">
              系统检测到题库中暂无题目，点击下方按钮一键导入内置题库，或在命令行运行{' '}
              <code className="bg-amber-100 px-1.5 py-0.5 rounded text-amber-800">
                npm run db:seed
              </code>
            </p>
            <button
              onClick={seedQuestions}
              disabled={seeding}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {seeding ? '导入中...' : '一键导入题库'}
            </button>
          </div>
        )}

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <BookOpen className="w-4 h-4" />
              <span className="text-sm">总题数</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {stats?.totalQuestions || 0}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-500 mb-2">
              <Target className="w-4 h-4" />
              <span className="text-sm">已掌握</span>
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              {stats?.mastered || 0}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-amber-500 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">待复习</span>
            </div>
            <div className="text-2xl font-bold text-amber-600">
              {stats?.review || 0}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-orange-500 mb-2">
              <Flame className="w-4 h-4" />
              <span className="text-sm">连续打卡</span>
            </div>
            <div className="text-2xl font-bold text-orange-600">
              {stats?.streak || 0} 天
            </div>
          </div>
        </div>

        {/* 主要内容 */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* 左侧：进度 */}
          <div className="md:col-span-2 space-y-6">
            {/* 总体进度 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                学习进度
              </h2>
              <div className="flex items-center gap-8">
                <SegmentedRing
                  mastered={stats?.mastered || 0}
                  review={stats?.review || 0}
                  unlearned={stats?.unlearned || 0}
                />
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-sm text-gray-600">
                      已掌握 {stats?.mastered || 0}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <span className="text-sm text-gray-600">
                      待复习 {stats?.review || 0}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-400" />
                    <span className="text-sm text-gray-600">
                      未学习 {stats?.unlearned || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 模块进度 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                模块进度
              </h2>
              <div className="space-y-4">
                {stats?.moduleProgress.map((mod) => (
                  <ModuleProgressBar
                    key={mod.module}
                    module={mod.module}
                    total={mod.total}
                    mastered={mod.mastered}
                    review={mod.review}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 右侧：快捷入口和笔记 */}
          <div className="space-y-6">
            {/* 快捷入口 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                快捷入口
              </h2>
              <div className="space-y-3">
                <Link
                  href="/interview/practice"
                  className="flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-900">专项练习</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-blue-400" />
                </Link>
                <Link
                  href="/interview/mock"
                  className="flex items-center justify-between p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Brain className="w-5 h-5 text-purple-600" />
                    <span className="font-medium text-purple-900">
                      模拟面试
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-purple-400" />
                </Link>
                <Link
                  href="/interview/weak"
                  className="flex items-center justify-between p-3 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Target className="w-5 h-5 text-amber-600" />
                    <span className="font-medium text-amber-900">薄弱点</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-amber-400" />
                </Link>
              </div>
            </div>

            {/* 最近笔记 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                最近笔记
              </h2>
              {recentNotes.length === 0 ? (
                <p className="text-sm text-gray-500">暂无笔记</p>
              ) : (
                <div className="space-y-3">
                  {recentNotes.map((note) => (
                    <Link
                      key={note.id}
                      href={`/interview/questions/${note.questionId}`}
                      className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Star className="w-3 h-3 text-amber-400" />
                        <span className="text-xs text-gray-500">
                          {note.question.module}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {note.question.question}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(note.updatedAt).toLocaleDateString()}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
