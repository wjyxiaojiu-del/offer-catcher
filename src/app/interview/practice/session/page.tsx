/**
 * 练习会话页
 */

'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  RotateCcw,
  BookOpen,
  Eye,
  EyeOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Question {
  id: string
  module: string
  difficulty: number
  question: string
  answer: string
  tags: string
}

function PracticeSessionContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState<Set<string>>(new Set())

  const modules = searchParams.get('modules') || ''
  const difficulty = searchParams.get('difficulty') || ''
  const status = searchParams.get('status') || ''
  const random = searchParams.get('random') === 'true'

  // 加载题目
  useEffect(() => {
    loadQuestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadQuestions() {
    try {
      const params = new URLSearchParams()
      if (modules) {
        // 取第一个模块（简化处理）
        const firstModule = modules.split(',')[0]
        params.set('module', firstModule)
      }
      if (difficulty) params.set('difficulty', difficulty)
      if (status) params.set('status', status)
      params.set('pageSize', '100')

      const res = await fetch(`/api/interview/questions?${params}`)
      const data = await res.json()

      let loadedQuestions = data.questions || []

      // 随机排序
      if (random) {
        loadedQuestions = [...loadedQuestions].sort(() => Math.random() - 0.5)
      }

      setQuestions(loadedQuestions)
    } catch (error) {
      console.error('加载题目失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const currentQuestion = questions[currentIndex]

  // 更新学习状态
  async function updateStatus(questionId: string, newStatus: string) {
    try {
      await fetch('/api/interview/progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, status: newStatus }),
      })
      setCompleted((prev) => new Set(Array.from(prev).concat(questionId)))
    } catch (error) {
      console.error('更新状态失败:', error)
    }
  }

  // 切换题目
  function goTo(index: number) {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index)
      setShowAnswer(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            没有符合条件的题目
          </h2>
          <p className="text-gray-500 mb-4">请调整筛选条件重试</p>
          <Link
            href="/interview/practice"
            className="text-blue-600 hover:text-blue-700"
          >
            返回配置
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/interview/practice"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            返回配置
          </Link>
          <div className="text-sm text-gray-500">
            {currentIndex + 1} / {questions.length}
          </div>
        </div>

        {/* 进度条 */}
        <div className="mb-6">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{
                width: `${((currentIndex + 1) / questions.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* 题目卡片 */}
        <div className="bg-white rounded-xl p-8 shadow-sm mb-6">
          {/* 标签 */}
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
              {currentQuestion.module}
            </span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
              {currentQuestion.difficulty === 1
                ? '初级'
                : currentQuestion.difficulty === 2
                  ? '中级'
                  : '高级'}
            </span>
            {completed.has(currentQuestion.id) && (
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                已完成
              </span>
            )}
          </div>

          {/* 题目 */}
          <h1 className="text-xl font-semibold text-gray-900 mb-8">
            {currentQuestion.question}
          </h1>

          {/* 答案区域 */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">
                参考答案
              </h2>
              <button
                onClick={() => setShowAnswer(!showAnswer)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                {showAnswer ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    隐藏
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    显示答案
                  </>
                )}
              </button>
            </div>

            {showAnswer ? (
              <div className="prose prose-sm max-w-none">
                <div
                  dangerouslySetInnerHTML={{
                    __html: currentQuestion.answer
                      .replace(/\n/g, '<br>')
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/`(.*?)`/g, '<code>$1</code>'),
                  }}
                />
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                先自己思考，点击「显示答案」查看参考
              </p>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronLeft className="w-4 h-4" />
            上一题
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => updateStatus(currentQuestion.id, 'review')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                'bg-amber-100 text-amber-700 hover:bg-amber-200'
              )}
            >
              <RotateCcw className="w-4 h-4 inline mr-1" />
              待复习
            </button>
            <button
              onClick={() => updateStatus(currentQuestion.id, 'mastered')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              )}
            >
              <CheckCircle2 className="w-4 h-4 inline mr-1" />
              已掌握
            </button>
          </div>

          <button
            onClick={() => goTo(currentIndex + 1)}
            disabled={currentIndex === questions.length - 1}
            className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
          >
            下一题
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 题目导航 */}
        <div className="mt-8 bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-medium text-gray-700 mb-3">题目导航</h3>
          <div className="flex flex-wrap gap-2">
            {questions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => goTo(idx)}
                className={cn(
                  'w-8 h-8 rounded text-xs font-medium transition-colors',
                  idx === currentIndex
                    ? 'bg-blue-600 text-white'
                    : completed.has(q.id)
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PracticeSessionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    }>
      <PracticeSessionContent />
    </Suspense>
  )
}
