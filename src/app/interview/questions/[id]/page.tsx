/**
 * 面试题目详情页
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  Star,
  MessageSquare,
  Copy,
  RefreshCw,
  Send,
  Loader2,
  BookOpen,
  CheckCircle2,
  RotateCcw,
  Save,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Question {
  id: string
  module: string
  difficulty: number
  question: string
  answer: string
  tags: string
  source?: string
  studyRecords: Array<{ status: string }>
  notes: Array<{ content: string }>
  flags: Array<{ starred: boolean }>
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const DIFFICULTY_LABELS: Record<number, string> = {
  1: '初级',
  2: '中级',
  3: '高级',
}

const QUICK_ACTIONS = [
  { id: 'analyze', label: '分析考点', prompt: '请分析这道题的核心考点和考察意图。' },
  { id: 'structure', label: '答题结构', prompt: '请给出一个清晰的答题结构框架。' },
  { id: 'explain', label: '讲解知识点', prompt: '请详细讲解这道题涉及的核心知识点。' },
  { id: 'optimize', label: '优化答案', prompt: '请优化我的答案，让它更适合面试场景。' },
  { id: 'followup', label: '追问预测', prompt: '面试官可能会如何追问这个问题？' },
  { id: 'pitfall', label: '踩坑提醒', prompt: '回答这个问题时有哪些常见的坑需要注意？' },
]

export default function QuestionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const questionId = params.id as string

  const [question, setQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string>('unlearned')
  const [isFlagged, setIsFlagged] = useState(false)
  const [note, setNote] = useState('')
  const [isEditingNote, setIsEditingNote] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)

  // AI 对话状态
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const loadQuestion = useCallback(async () => {
    try {
      const res = await fetch(`/api/interview/questions/${questionId}`)
      if (!res.ok) {
        router.push('/interview/questions')
        return
      }
      const data = await res.json()
      setQuestion(data)
      setStatus(data.studyRecords[0]?.status || 'unlearned')
      setIsFlagged(data.flags[0]?.starred || false)
      setNote(data.notes[0]?.content || '')
    } catch (error) {
      console.error('加载题目失败:', error)
    } finally {
      setLoading(false)
    }
  }, [questionId, router])

  // 加载题目数据
  useEffect(() => {
    loadQuestion()
  }, [loadQuestion])

  // 更新学习状态
  async function updateStatus(newStatus: string) {
    try {
      await fetch('/api/interview/progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, status: newStatus }),
      })
      setStatus(newStatus)
    } catch (error) {
      console.error('更新状态失败:', error)
    }
  }

  // 切换重点标记
  async function toggleFlag() {
    try {
      await fetch('/api/interview/flags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId }),
      })
      setIsFlagged(!isFlagged)
    } catch (error) {
      console.error('切换标记失败:', error)
    }
  }

  // 保存笔记
  async function saveNote() {
    try {
      await fetch('/api/interview/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, content: note }),
      })
      setIsEditingNote(false)
    } catch (error) {
      console.error('保存笔记失败:', error)
    }
  }

  // 发送 AI 消息
  async function sendMessage(content: string) {
    if (!content.trim() || isChatLoading) return

    const userMessage: ChatMessage = { role: 'user', content }
    setChatMessages((prev) => [...prev, userMessage])
    setChatInput('')
    setIsChatLoading(true)

    try {
      const systemPrompt = `你是一位资深技术面试教练。当前题目：
模块：${question?.module}
难度：${DIFFICULTY_LABELS[question?.difficulty || 1]}
题目：${question?.question}
参考答案：${question?.answer}

请根据用户的问题，给出专业、清晰的解答。使用 Markdown 格式。`

      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          systemPrompt,
          history: chatMessages,
        }),
      })

      if (!res.ok) throw new Error('请求失败')

      const data = await res.json()
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response || '抱歉，我无法回答这个问题。',
      }
      setChatMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('AI 对话失败:', error)
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '抱歉，发生了错误，请重试。' },
      ])
    } finally {
      setIsChatLoading(false)
    }
  }

  // 复制答案
  function copyAnswer() {
    if (question?.answer) {
      navigator.clipboard.writeText(question.answer)
    }
  }

  // 滚动到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">题目不存在</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* 头部 */}
        <div className="mb-6">
          <Link
            href="/interview/questions"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            返回题库
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 左侧：题目和答案 */}
          <div className="space-y-4">
            {/* 题目卡片 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              {/* 标签栏 */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                  {question.module}
                </span>
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                  {DIFFICULTY_LABELS[question.difficulty]}
                </span>
                <button
                  onClick={toggleFlag}
                  className={cn(
                    'p-1 rounded transition-colors',
                    isFlagged
                      ? 'text-amber-500'
                      : 'text-gray-400 hover:text-amber-500'
                  )}
                >
                  <Star
                    className={cn('w-4 h-4', isFlagged && 'fill-amber-400')}
                  />
                </button>
              </div>

              {/* 题目 */}
              <h1 className="text-lg font-semibold text-gray-900 mb-6">
                {question.question}
              </h1>

              {/* 学习状态 */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-gray-500">学习状态：</span>
                <div className="flex gap-2">
                  {[
                    { value: 'unlearned', label: '未学习', icon: BookOpen },
                    { value: 'review', label: '待复习', icon: RotateCcw },
                    { value: 'mastered', label: '已掌握', icon: CheckCircle2 },
                  ].map((s) => {
                    const Icon = s.icon
                    return (
                      <button
                        key={s.value}
                        onClick={() => updateStatus(s.value)}
                        className={cn(
                          'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                          status === s.value
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                      >
                        <Icon className="w-3 h-3" />
                        {s.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* 参考答案 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">
                  参考答案
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={copyAnswer}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    title="复制答案"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowAnswer(!showAnswer)}
                    className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    {showAnswer ? '收起' : '展开'}
                  </button>
                </div>
              </div>

              {showAnswer ? (
                <div className="prose prose-sm max-w-none">
                  <div
                    dangerouslySetInnerHTML={{
                      __html: question.answer
                        .replace(/\n/g, '<br>')
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/`(.*?)`/g, '<code>$1</code>'),
                    }}
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-500">点击「展开」查看参考答案</p>
              )}
            </div>

            {/* 笔记 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">笔记</h2>
                {isEditingNote ? (
                  <button
                    onClick={saveNote}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    <Save className="w-3 h-3" />
                    保存
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditingNote(true)}
                    className="text-sm text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg"
                  >
                    {note ? '编辑' : '添加笔记'}
                  </button>
                )}
              </div>

              {isEditingNote ? (
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="记录你的理解、易错点、面试表达..."
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              ) : (
                <div className="text-sm text-gray-600">
                  {note || '暂无笔记'}
                </div>
              )}
            </div>
          </div>

          {/* 右侧：AI 对话 */}
          <div className="bg-white rounded-xl shadow-sm flex flex-col h-[calc(100vh-120px)] sticky top-20">
            {/* AI 对话头部 */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-semibold text-gray-900">
                  AI 面试教练
                </h2>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                按 A 快捷键呼出，支持追问和批改
              </p>
            </div>

            {/* 快捷动作 */}
            <div className="p-3 border-b border-gray-200 flex gap-2 overflow-x-auto">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  onClick={() => sendMessage(action.prompt)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-xs hover:bg-gray-200 whitespace-nowrap transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>

            {/* 对话内容 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>点击快捷动作或输入问题开始对话</p>
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex',
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] rounded-lg px-4 py-2 text-sm',
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      )}
                    >
                      <div
                        dangerouslySetInnerHTML={{
                          __html: msg.content
                            .replace(/\n/g, '<br>')
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/`(.*?)`/g, '<code>$1</code>'),
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* 输入框 */}
            <div className="p-4 border-t border-gray-200">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  sendMessage(chatInput)
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="输入问题..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isChatLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
