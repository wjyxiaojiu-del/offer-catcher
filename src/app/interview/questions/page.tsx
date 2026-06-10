/**
 * 面试题目列表页
 */

'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Star,
  MessageSquare,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Question {
  id: string
  module: string
  difficulty: number
  question: string
  tags: string
  source?: string
}

interface Module {
  name: string
  count: number
}

interface StudyRecord {
  questionId: string
  status: string
}

interface PaginatedResult {
  questions: Question[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const DIFFICULTY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: '初级', color: 'bg-green-100 text-green-700' },
  2: { label: '中级', color: 'bg-yellow-100 text-yellow-700' },
  3: { label: '高级', color: 'bg-red-100 text-red-700' },
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  unlearned: { label: '未学习', color: 'bg-gray-100 text-gray-600' },
  review: { label: '待复习', color: 'bg-amber-100 text-amber-700' },
  mastered: { label: '已掌握', color: 'bg-emerald-100 text-emerald-700' },
}

function QuestionListContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [questions, setQuestions] = useState<Question[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [studyRecords, setStudyRecords] = useState<Record<string, string>>({})
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set())
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showFilter, setShowFilter] = useState(false)

  // 筛选条件
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [module, setModule] = useState(searchParams.get('module') || '')
  const [difficulty, setDifficulty] = useState(
    searchParams.get('difficulty') || ''
  )
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [starred, setStarred] = useState(
    searchParams.get('starred') === 'true'
  )
  const [page, setPage] = useState(
    parseInt(searchParams.get('page') || '1')
  )

  // 加载模块列表
  useEffect(() => {
    fetch('/api/interview/questions/modules')
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setModules(Array.isArray(data) ? data : []))
      .catch(console.error)
  }, [])

  // 加载学习记录和标记
  useEffect(() => {
    Promise.all([
      fetch('/api/interview/progress').then((res) => res.ok ? res.json() : []),
      fetch('/api/interview/flags').then((res) => res.ok ? res.json() : []),
    ])
      .then(([records, flags]) => {
        const recordMap: Record<string, string> = {}
        if (Array.isArray(records)) {
          for (const r of records) {
            recordMap[r.questionId] = r.status
          }
        }
        setStudyRecords(recordMap)
        setFlaggedIds(new Set(Array.isArray(flags) ? flags : []))
      })
      .catch(console.error)
  }, [])

  // 加载题目列表
  const loadQuestions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (module) params.set('module', module)
      if (difficulty) params.set('difficulty', difficulty)
      if (status) params.set('status', status)
      if (starred) params.set('starred', 'true')
      params.set('page', page.toString())
      params.set('pageSize', '30')

      const res = await fetch(`/api/interview/questions?${params}`)
      if (!res.ok) {
        setQuestions([])
        setTotal(0)
        setTotalPages(0)
        return
      }
      const data: PaginatedResult = await res.json()

      setQuestions(data.questions || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 0)
    } catch (error) {
      console.error('加载题目失败:', error)
      setQuestions([])
    } finally {
      setLoading(false)
    }
  }, [search, module, difficulty, status, starred, page])

  useEffect(() => {
    loadQuestions()
  }, [loadQuestions])

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      loadQuestions()
    }, 300)
    return () => clearTimeout(timer)
  }, [search, loadQuestions])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link
              href="/interview"
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
            >
              <ChevronLeft className="w-4 h-4" />
              返回仪表盘
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">题库</h1>
            <p className="text-gray-500 mt-1">共 {total} 道题目</p>
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors',
              showFilter
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            )}
          >
            <Filter className="w-4 h-4" />
            筛选
          </button>
        </div>

        {/* 搜索栏 */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索题目、标签、模块..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* 筛选面板 */}
        {showFilter && (
          <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* 模块筛选 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  模块
                </label>
                <select
                  value={module}
                  onChange={(e) => {
                    setModule(e.target.value)
                    setPage(1)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">全部模块</option>
                  {modules.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name} ({m.count})
                    </option>
                  ))}
                </select>
              </div>

              {/* 难度筛选 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  难度
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => {
                    setDifficulty(e.target.value)
                    setPage(1)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">全部难度</option>
                  <option value="1">初级</option>
                  <option value="2">中级</option>
                  <option value="3">高级</option>
                </select>
              </div>

              {/* 状态筛选 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  学习状态
                </label>
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value)
                    setPage(1)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">全部状态</option>
                  <option value="unlearned">未学习</option>
                  <option value="review">待复习</option>
                  <option value="mastered">已掌握</option>
                </select>
              </div>

              {/* 重点题筛选 */}
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={starred}
                    onChange={(e) => {
                      setStarred(e.target.checked)
                      setPage(1)
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">仅重点题</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* 题目列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : questions.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              没有找到题目
            </h3>
            <p className="text-gray-500">尝试调整筛选条件</p>
          </div>
        ) : (
          <div className="space-y-2">
            {questions.map((q) => {
              const status = studyRecords[q.id] || 'unlearned'
              const isFlagged = flaggedIds.has(q.id)
              const difficultyInfo = DIFFICULTY_LABELS[q.difficulty]
              const statusInfo = STATUS_LABELS[status]

              return (
                <Link
                  key={q.id}
                  href={`/interview/questions/${q.id}`}
                  className="block bg-white rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    {/* 状态指示条 */}
                    <div
                      className={cn(
                        'w-1 self-stretch rounded-full',
                        status === 'mastered'
                          ? 'bg-emerald-500'
                          : status === 'review'
                            ? 'bg-amber-400'
                            : 'bg-gray-300'
                      )}
                    />

                    <div className="flex-1 min-w-0">
                      {/* 题目 */}
                      <h3 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">
                        {q.question}
                      </h3>

                      {/* 标签 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            difficultyInfo?.color
                          )}
                        >
                          {difficultyInfo?.label}
                        </span>
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                          {q.module}
                        </span>
                        {statusInfo && (
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-xs',
                              statusInfo.color
                            )}
                          >
                            {statusInfo.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 右侧图标 */}
                    <div className="flex items-center gap-2">
                      {isFlagged && (
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg bg-white border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600">
              第 {page} / {totalPages} 页
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg bg-white border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function QuestionListPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    }>
      <QuestionListContent />
    </Suspense>
  )
}
