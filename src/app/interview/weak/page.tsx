/**
 * 薄弱点分析页
 */

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  Target,
  AlertTriangle,
  BookOpen,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface WeakPoint {
  module: string
  questionId: string
  question: string
  reviewCount: number
  status: string
}

export default function WeakPointsPage() {
  const [weakPoints, setWeakPoints] = useState<WeakPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/interview/weak-points?limit=30')
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          console.error(data.error?.message || data.error || '获取薄弱点失败')
          setWeakPoints([])
          return
        }
        setWeakPoints(Array.isArray(data) ? data : data.weakPoints || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // 按模块分组
  const groupedByModule = weakPoints.reduce(
    (acc, point) => {
      if (!acc[point.module]) {
        acc[point.module] = []
      }
      acc[point.module].push(point)
      return acc
    },
    {} as Record<string, WeakPoint[]>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* 头部 */}
        <div className="mb-6">
          <Link
            href="/interview"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            返回仪表盘
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">薄弱点分析</h1>
          <p className="text-gray-500 mt-1">
            基于复习频次聚合，聚焦最需强化的知识点
          </p>
        </div>

        {weakPoints.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              暂无薄弱点数据
            </h2>
            <p className="text-gray-500 mb-4">
              开始刷题后，这里会显示你的薄弱知识点
            </p>
            <Link
              href="/interview/questions"
              className="text-blue-600 hover:text-blue-700"
            >
              去刷题 →
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 统计概览 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 text-amber-500 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">薄弱题目</span>
                </div>
                <div className="text-2xl font-bold text-amber-600">
                  {weakPoints.length}
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 text-blue-500 mb-2">
                  <BookOpen className="w-4 h-4" />
                  <span className="text-sm">涉及模块</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {Object.keys(groupedByModule).length}
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 text-red-500 mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm">最高复习</span>
                </div>
                <div className="text-2xl font-bold text-red-600">
                  {weakPoints[0]?.reviewCount || 0} 次
                </div>
              </div>
            </div>

            {/* 按模块分组 */}
            {Object.entries(groupedByModule).map(([module, points]) => (
              <div
                key={module}
                className="bg-white rounded-xl p-6 shadow-sm"
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {module}
                </h2>
                <div className="space-y-3">
                  {points.map((point) => (
                    <Link
                      key={point.questionId}
                      href={`/interview/questions/${point.questionId}`}
                      className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-gray-900 mb-1">
                            {point.question}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded text-xs',
                                point.status === 'review'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-gray-100 text-gray-600'
                              )}
                            >
                              {point.status === 'review' ? '待复习' : '未学习'}
                            </span>
                            <span className="text-xs text-gray-500">
                              复习 {point.reviewCount} 次
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(point.reviewCount, 5) }).map(
                            (_, i) => (
                              <div
                                key={i}
                                className="w-2 h-2 rounded-full bg-amber-400"
                              />
                            )
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
