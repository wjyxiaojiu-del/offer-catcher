/**
 * 专项练习配置页
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  Zap,
  BookOpen,
  Target,
  Shuffle,
  Play,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Module {
  name: string
  count: number
}

export default function PracticePage() {
  const router = useRouter()

  const [modules, setModules] = useState<Module[]>([])
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set())
  const [difficulty, setDifficulty] = useState<number | null>(null)
  const [status, setStatus] = useState<string>('')
  const [randomOrder, setRandomOrder] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/interview/questions/modules')
      .then((res) => res.json())
      .then((data) => {
        setModules(data)
        setSelectedModules(new Set(data.map((m: Module) => m.name)))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function toggleModule(name: string) {
    const next = new Set(selectedModules)
    if (next.has(name)) {
      next.delete(name)
    } else {
      next.add(name)
    }
    setSelectedModules(next)
  }

  function selectAll() {
    setSelectedModules(new Set(modules.map((m) => m.name)))
  }

  function selectNone() {
    setSelectedModules(new Set())
  }

  async function startPractice() {
    if (selectedModules.size === 0) return

    // 构建查询参数
    const params = new URLSearchParams()
    params.set('modules', Array.from(selectedModules).join(','))
    if (difficulty) params.set('difficulty', difficulty.toString())
    if (status) params.set('status', status)
    if (randomOrder) params.set('random', 'true')

    router.push(`/interview/practice/session?${params}`)
  }

  const selectedCount = modules
    .filter((m) => selectedModules.has(m.name))
    .reduce((sum, m) => sum + m.count, 0)

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
          <h1 className="text-2xl font-bold text-gray-900">专项练习</h1>
          <p className="text-gray-500 mt-1">选择模块和条件，开始刷题</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* 左侧：配置 */}
          <div className="md:col-span-2 space-y-6">
            {/* 模块选择 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  选择模块
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    全选
                  </button>
                  <button
                    onClick={selectNone}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    清空
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {modules.map((mod) => (
                  <button
                    key={mod.name}
                    onClick={() => toggleModule(mod.name)}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border transition-colors',
                      selectedModules.has(mod.name)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <span className="text-sm font-medium text-gray-700">
                      {mod.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {mod.count} 题
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 难度筛选 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                难度筛选
              </h2>
              <div className="flex gap-2">
                {[
                  { value: null, label: '全部' },
                  { value: 1, label: '初级' },
                  { value: 2, label: '中级' },
                  { value: 3, label: '高级' },
                ].map((d) => (
                  <button
                    key={d.value ?? 'all'}
                    onClick={() => setDifficulty(d.value)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      difficulty === d.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 状态筛选 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                学习状态
              </h2>
              <div className="flex gap-2">
                {[
                  { value: '', label: '全部' },
                  { value: 'unlearned', label: '未学习' },
                  { value: 'review', label: '待复习' },
                  { value: 'mastered', label: '已掌握' },
                ].map((s) => (
                  <button
                    key={s.value || 'all'}
                    onClick={() => setStatus(s.value)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      status === s.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 随机顺序 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={randomOrder}
                  onChange={(e) => setRandomOrder(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <Shuffle className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-gray-700">随机顺序</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    打乱题目顺序，避免记忆依赖
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* 右侧：预览和开始 */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-6 shadow-sm sticky top-20">
              <h3 className="font-semibold text-gray-900 mb-4">练习预览</h3>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">已选模块</span>
                  <span className="font-medium">{selectedModules.size} 个</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">题目数量</span>
                  <span className="font-medium">{selectedCount} 题</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">难度</span>
                  <span className="font-medium">
                    {difficulty
                      ? difficulty === 1
                        ? '初级'
                        : difficulty === 2
                          ? '中级'
                          : '高级'
                      : '全部'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">顺序</span>
                  <span className="font-medium">
                    {randomOrder ? '随机' : '顺序'}
                  </span>
                </div>
              </div>

              <button
                onClick={startPractice}
                disabled={selectedModules.size === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                <Play className="w-4 h-4" />
                开始练习
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
