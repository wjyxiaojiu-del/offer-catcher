"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Bot, Target, PenLine, Paperclip } from "lucide-react"
import { useToast } from "@/components/ui/toast"
import { renderMarkdown } from "@/lib/markdown"
import { scoreColor } from "@/lib/ui-utils"
import { useChatSessions, type ChatMessage } from "@/hooks/useChatSessions"
import { useAgentStream } from "@/hooks/useAgentStream"

const STORAGE_KEY = "offer-catcher-agent-sessions"

// ============ Components ============

function MatchCardInline({ m, onClick }: { m: any; onClick: () => void }) {
  return (
    <div
      className="bg-white border rounded-xl p-3 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm truncate">{m.title}</h4>
          <p className="text-xs text-gray-500">{m.company} · {m.location}</p>
        </div>
        <span className={`text-sm font-bold ml-2 ${scoreColor(m.score)}`}>
          {m.score}%
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {(m.matchedSkills || []).slice(0, 4).map((s: string, j: number) => (
          <span key={j} className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px]">{s}</span>
        ))}
      </div>
    </div>
  )
}

// ============ Main Page ============

export default function AgentPage() {
  const router = useRouter()
  const { toast } = useToast()
  const {
    sessions,
    currentSessionId,
    messages,
    createSession,
    switchSession,
    deleteSession,
    updateCurrentSession,
    ensureSession,
  } = useChatSessions({ storageKey: STORAGE_KEY })
  const { isLoading, sendMessage: streamSend } = useAgentStream()

  const [input, setInput] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto scroll on new messages / loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  const sendMessage = useCallback(
    async (text: string, resumeText?: string) => {
      if (!text.trim() && !resumeText) return

      const sid = ensureSession(text.trim())

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim() || "已上传简历",
        timestamp: Date.now(),
      }
      const newMessages = [...messages, userMsg]
      updateCurrentSession(newMessages)
      setInput("")

      const result = await streamSend({
        message: text,
        sessionId: sid,
        resumeText,
      })

      const agentMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "agent",
        content: result.content || "抱歉，没有获取到回复。",
        thinking: result.thinking,
        tasks: result.tasks,
        matches: result.matches,
        timestamp: Date.now(),
      }
      updateCurrentSession([...newMessages, agentMsg])
    },
    [messages, ensureSession, updateCurrentSession, streamSend]
  )

  const handleFileUpload = useCallback(
    async (file: File) => {
      const validTypes = [".txt", ".pdf", ".docx", ".doc"]
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()
      if (!validTypes.includes(ext)) {
        toast("请上传 TXT / PDF / DOCX 格式的文件", "error")
        return
      }

      let text = ""
      if (ext === ".txt") {
        text = await file.text()
      } else {
        const formData = new FormData()
        formData.append("file", file)
        try {
          const res = await fetch("/api/resume", { method: "POST", body: formData })
          const data = await res.json()
          if (data.resume) {
            text = data.resume.rawText
          } else {
            toast(data.error || "文件解析失败", "error")
            return
          }
        } catch {
          toast("文件上传失败", "error")
          return
        }
      }

      if (text.trim()) {
        await sendMessage("请帮我解析这份简历", text.trim())
      }
    },
    [sendMessage, toast]
  )

  const toggleThinking = (msgId: string) => {
    setExpandedThinking((prev) => ({ ...prev, [msgId]: !prev[msgId] }))
  }

  return (
    <div className="flex h-[calc(100vh-56px)] bg-gray-50">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white border-r flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `} style={{ top: "3.5rem", height: "calc(100vh - 3.5rem)" }}>
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-bold text-sm text-gray-700">会话历史</h2>
          <button
            onClick={() => {
              createSession()
              setSidebarOpen(false)
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-blue-600 transition-colors"
            aria-label="新建会话"
            title="新建会话"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sessions.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-8">暂无会话，点击 + 新建</p>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => {
                switchSession(s.id)
                setSidebarOpen(false)
              }}
              className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all text-sm
                ${s.id === currentSessionId
                  ? "bg-blue-50 border border-blue-200 text-blue-700"
                  : "hover:bg-gray-50 border border-transparent text-gray-700"
                }`}
            >
              <span className="truncate flex-1 font-medium">{s.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteSession(s.id)
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-500 transition-all"
                aria-label="删除会话"
                title="删除"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="打开侧边栏"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-gray-700" />
            <h1 className="font-bold text-sm sm:text-base text-gray-900">
              Offer捕手求职Agent
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs text-gray-500 hidden sm:inline">在线</span>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <Bot className="w-14 h-14 mx-auto mb-4 text-gray-300" />
              <h2 className="text-lg font-bold text-gray-700 mb-2">我是你的求职Agent</h2>
              <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
                我可以帮你解析简历、匹配岗位、优化简历、模拟投递，还能提供职业建议。
                上传简历或直接开始对话吧！
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {["帮我找前端岗位", "优化我的简历", "模拟面试", "职业规划建议"].map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="px-4 py-2 bg-white border rounded-xl text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "agent" && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-1">
                  AI
                </div>
              )}
              <div className={`max-w-[85%] sm:max-w-[75%] ${msg.role === "user" ? "order-first" : ""}`}>
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                      : "bg-white border shadow-sm text-gray-800"
                  }`}
                >
                  {msg.role === "agent" ? renderMarkdown(msg.content) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                </div>

                {/* Thinking panel */}
                {msg.role === "agent" && (msg.thinking?.length || 0) > 0 && (
                  <div className="mt-2">
                    <button
                      onClick={() => toggleThinking(msg.id)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors"
                    >
                      <svg
                        className={`transition-transform ${expandedThinking[msg.id] ? "rotate-90" : ""}`}
                        xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      思考过程 ({msg.thinking!.length} 步)
                    </button>
                    {expandedThinking[msg.id] && (
                      <div className="mt-1.5 bg-gray-50 rounded-xl border p-3 space-y-1.5">
                        {msg.thinking!.map((t, i) => (
                          <div key={i} className="text-xs text-gray-600 flex items-start gap-2">
                            <span className="text-blue-500 font-mono flex-shrink-0">{i + 1}.</span>
                            <span>{t}</span>
                          </div>
                        ))}
                        {msg.tasks && msg.tasks.length > 0 && (
                          <div className="pt-2 border-t mt-2">
                            <p className="text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">任务执行</p>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.tasks.map((t) => (
                                <span
                                  key={t.id}
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                    t.status === "completed"
                                      ? "bg-green-100 text-green-700"
                                      : t.status === "failed"
                                      ? "bg-red-100 text-red-700"
                                      : t.status === "running"
                                      ? "bg-blue-100 text-blue-700 animate-pulse"
                                      : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {t.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Match results cards */}
                {msg.role === "agent" && msg.matches && msg.matches.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-500">匹配结果</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {msg.matches.slice(0, 4).map((m: any, i: number) => (
                        <MatchCardInline
                          key={i}
                          m={m}
                          onClick={() => router.push(`/match?jobId=${m.jobId}`)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-gray-400 mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0">
                AI
              </div>
              <div className="bg-white border rounded-2xl px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                  <span className="text-xs text-gray-500">Agent 正在思考...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white border-t px-4 py-3">
          {/* Quick actions */}
          <div className="flex gap-2 mb-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => sendMessage("帮我匹配岗位")}
              disabled={isLoading}
              className="flex-shrink-0 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              <Target className="w-3 h-3" /> 帮我匹配岗位
            </button>
            <button
              onClick={() => sendMessage("优化我的简历")}
              disabled={isLoading}
              className="flex-shrink-0 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium hover:bg-purple-100 transition-colors disabled:opacity-50"
            >
              <PenLine className="w-3 h-3" /> 优化简历
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="flex-shrink-0 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
            >
              <Paperclip className="w-3 h-3" /> 上传简历
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.pdf,.docx,.doc"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file)
                e.target.value = ""
              }}
            />
          </div>

          {/* Text input */}
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  if (!isLoading) sendMessage(input)
                }
              }}
              placeholder="输入消息，或上传简历开始..."
              rows={1}
              className="flex-1 resize-none border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all min-h-[42px] max-h-[120px]"
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:hover:shadow-none active:scale-95 flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              <span className="hidden sm:inline">发送</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
