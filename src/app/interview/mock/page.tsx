/**
 * 模拟面试页
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  Brain,
  Send,
  Loader2,
  Play,
  StopCircle,
  MessageSquare,
  FileText,
  Star,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MockInterview {
  id: string
  status: string
  jobTitle?: string
  score?: number
  createdAt: string
}

interface InterviewPlan {
  summary: string
  focusAreas: string[]
  sections: Array<{
    name: string
    description: string
    questionCount: number
  }>
  openingQuestion: string
}

interface InterviewReport {
  overallScore: number
  summary: string
  dimensions: Array<{
    name: string
    score: number
    comment: string
  }>
  strengths: string[]
  improvements: string[]
}

export default function MockInterviewPage() {
  const [interviews, setInterviews] = useState<MockInterview[]>([])
  const [loading, setLoading] = useState(true)

  // 新建面试表单
  const [showForm, setShowForm] = useState(false)
  const [jobTitle, setJobTitle] = useState('')
  const [jobLevel, setJobLevel] = useState('')
  const [jdText, setJdText] = useState('')
  const [creating, setCreating] = useState(false)

  // 当前面试
  const [currentInterview, setCurrentInterview] = useState<string | null>(null)
  const [plan, setPlan] = useState<InterviewPlan | null>(null)
  const [turns, setTurns] = useState<Array<{ role: string; content: string }>>(
    []
  )
  const [report, setReport] = useState<InterviewReport | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [userInput, setUserInput] = useState('')

  const chatEndRef = useRef<HTMLDivElement>(null)

  // 加载面试列表
  useEffect(() => {
    loadInterviews()
  }, [])

  async function loadInterviews() {
    try {
      const res = await fetch('/api/interview/mock')
      if (res.ok) {
        setInterviews(await res.json())
      }
    } catch (error) {
      console.error('加载面试列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 创建新面试
  async function createInterview() {
    if (!jobTitle.trim()) return

    setCreating(true)
    try {
      const res = await fetch('/api/interview/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobTitle, jobLevel, jdText }),
      })

      if (res.ok) {
        const interview = await res.json()
        setInterviews((prev) => [interview, ...prev])
        setShowForm(false)
        setJobTitle('')
        setJobLevel('')
        setJdText('')
        // 自动开始面试
        startInterview(interview.id)
      }
    } catch (error) {
      console.error('创建面试失败:', error)
    } finally {
      setCreating(false)
    }
  }

  // 开始面试
  async function startInterview(interviewId: string) {
    setCurrentInterview(interviewId)
    setPlan(null)
    setTurns([])
    setReport(null)

    try {
      const res = await fetch('/api/interview/mock/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId, action: 'start' }),
      })

      if (!res.ok) throw new Error('请求失败')

      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n').filter((line) => line.startsWith('data: '))

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'thinking') {
              setIsThinking(true)
            } else if (data.type === 'plan') {
              setPlan(data.plan)
            } else if (data.type === 'question') {
              setIsThinking(false)
              setTurns((prev) => [
                ...prev,
                { role: 'interviewer', content: data.content },
              ])
            } else if (data.type === 'complete') {
              setIsThinking(false)
              setTurns((prev) => [
                ...prev,
                { role: 'interviewer', content: data.content },
              ])
            } else if (data.type === 'report') {
              setReport(data.report)
            } else if (data.type === 'error') {
              setIsThinking(false)
              console.error('面试错误:', data.content)
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch (error) {
      console.error('开始面试失败:', error)
    }
  }

  // 发送回答
  async function sendAnswer() {
    if (!userInput.trim() || !currentInterview || isThinking) return

    const answer = userInput
    setUserInput('')
    setTurns((prev) => [...prev, { role: 'candidate', content: answer }])
    setIsThinking(true)

    try {
      const res = await fetch('/api/interview/mock/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId: currentInterview,
          action: 'answer',
          message: answer,
        }),
      })

      if (!res.ok) throw new Error('请求失败')

      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n').filter((line) => line.startsWith('data: '))

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'thinking') {
              setIsThinking(true)
            } else if (data.type === 'question') {
              setIsThinking(false)
              setTurns((prev) => [
                ...prev,
                { role: 'interviewer', content: data.content },
              ])
            } else if (data.type === 'complete') {
              setIsThinking(false)
              setTurns((prev) => [
                ...prev,
                { role: 'interviewer', content: data.content },
              ])
            } else if (data.type === 'report') {
              setReport(data.report)
              setIsThinking(false)
            } else if (data.type === 'error') {
              setIsThinking(false)
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch (error) {
      console.error('发送回答失败:', error)
      setIsThinking(false)
    }
  }

  // 结束面试
  async function endInterview() {
    if (!currentInterview) return

    setIsThinking(true)

    try {
      const res = await fetch('/api/interview/mock/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId: currentInterview,
          action: 'end',
        }),
      })

      if (!res.ok) throw new Error('请求失败')

      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n').filter((line) => line.startsWith('data: '))

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'thinking') {
              setIsThinking(true)
            } else if (data.type === 'report') {
              setReport(data.report)
              setIsThinking(false)
            } else if (data.type === 'error') {
              setIsThinking(false)
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch (error) {
      console.error('结束面试失败:', error)
      setIsThinking(false)
    }
  }

  // 删除面试
  async function deleteInterview(id: string) {
    try {
      await fetch(`/api/interview/mock/${id}`, { method: 'DELETE' })
      setInterviews((prev) => prev.filter((i) => i.id !== id))
      if (currentInterview === id) {
        setCurrentInterview(null)
        setPlan(null)
        setTurns([])
        setReport(null)
      }
    } catch (error) {
      console.error('删除面试失败:', error)
    }
  }

  // 滚动到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns])

  // 快捷键
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'a' && !e.ctrlKey && !e.metaKey) {
        const activeEl = document.activeElement
        if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA') {
          return
        }
        e.preventDefault()
        document.querySelector<HTMLInputElement>('[data-chat-input]')?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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
            <h1 className="text-2xl font-bold text-gray-900">模拟面试</h1>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            新建面试
          </button>
        </div>

        {/* 新建面试表单 */}
        {showForm && (
          <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              创建模拟面试
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  目标岗位 *
                </label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="例如：前端工程师"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  级别
                </label>
                <input
                  type="text"
                  value={jobLevel}
                  onChange={(e) => setJobLevel(e.target.value)}
                  placeholder="例如：高级 / 3-5年"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  岗位描述 (JD)
                </label>
                <textarea
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  placeholder="粘贴岗位描述，让面试更有针对性..."
                  className="w-full h-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  取消
                </button>
                <button
                  onClick={createInterview}
                  disabled={!jobTitle.trim() || creating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  创建并开始
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {/* 左侧：面试列表 */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">面试记录</h2>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : interviews.length === 0 ? (
              <div className="bg-white rounded-xl p-6 text-center">
                <Brain className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">暂无面试记录</p>
              </div>
            ) : (
              <div className="space-y-2">
                {interviews.map((interview) => (
                  <div
                    key={interview.id}
                    className={cn(
                      'bg-white rounded-lg p-3 cursor-pointer transition-all',
                      currentInterview === interview.id
                        ? 'ring-2 ring-blue-500'
                        : 'hover:shadow-md'
                    )}
                    onClick={() => {
                      if (interview.status === 'completed') {
                        // 加载已完成的面试
                        setCurrentInterview(interview.id)
                      } else {
                        startInterview(interview.id)
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">
                          {interview.jobTitle || '技术面试'}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(interview.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {interview.score && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                            {interview.score}分
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteInterview(interview.id)
                          }}
                          className="p-1 text-gray-400 hover:text-red-500 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-xs',
                          interview.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700'
                            : interview.status === 'interviewing'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-gray-100 text-gray-600'
                        )}
                      >
                        {interview.status === 'completed'
                          ? '已完成'
                          : interview.status === 'interviewing'
                            ? '进行中'
                            : '待开始'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 右侧：面试对话 */}
          <div className="md:col-span-2">
            {currentInterview ? (
              <div className="bg-white rounded-xl shadow-sm flex flex-col h-[calc(100vh-180px)]">
                {/* 面试信息 */}
                {plan && (
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                      面试计划
                    </h3>
                    <p className="text-xs text-gray-600">{plan.summary}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {plan.focusAreas.map((area, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 对话内容 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {turns.length === 0 && !isThinking && (
                    <div className="text-center text-gray-400 py-8">
                      <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>面试即将开始...</p>
                    </div>
                  )}

                  {turns.map((turn, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex',
                        turn.role === 'candidate'
                          ? 'justify-end'
                          : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[80%] rounded-lg px-4 py-3 text-sm',
                          turn.role === 'candidate'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        )}
                      >
                        {turn.role === 'interviewer' && (
                          <div className="flex items-center gap-1 mb-1">
                            <MessageSquare className="w-3 h-3" />
                            <span className="text-xs font-medium">面试官</span>
                          </div>
                        )}
                        <div
                          dangerouslySetInnerHTML={{
                            __html: turn.content
                              .replace(/\n/g, '<br>')
                              .replace(
                                /\*\*(.*?)\*\*/g,
                                '<strong>$1</strong>'
                              ),
                          }}
                        />
                      </div>
                    </div>
                  ))}

                  {isThinking && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 rounded-lg px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                          <span className="text-sm text-gray-500">
                            面试官思考中...
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* 复盘报告 */}
                {report && (
                  <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      面试复盘
                    </h3>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600">
                          {report.overallScore}
                        </div>
                        <div className="text-xs text-gray-500">总分</div>
                      </div>
                      <div className="flex-1 space-y-1">
                        {report.dimensions.map((dim, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-20">
                              {dim.name}
                            </span>
                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${dim.score}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 w-8">
                              {dim.score}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">{report.summary}</p>
                    <div className="mt-2 flex gap-2">
                      <Link
                        href="/interview/weak"
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        查看薄弱点 →
                      </Link>
                    </div>
                  </div>
                )}

                {/* 输入框 */}
                {!report && (
                  <div className="p-4 border-t border-gray-200">
                    <div className="flex gap-2 mb-2">
                      <button
                        onClick={endInterview}
                        className="px-3 py-1.5 text-xs text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                      >
                        <StopCircle className="w-3 h-3 inline mr-1" />
                        结束面试
                      </button>
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        sendAnswer()
                      }}
                      className="flex gap-2"
                    >
                      <input
                        data-chat-input
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        placeholder="输入你的回答... (按 A 呼出)"
                        disabled={isThinking}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={!userInput.trim() || isThinking}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl p-12 text-center h-[calc(100vh-180px)] flex items-center justify-center">
                <div>
                  <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">
                    选择或创建面试
                  </h2>
                  <p className="text-gray-500 mb-4">
                    从左侧选择历史面试，或点击「新建面试」开始
                  </p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    新建面试
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
