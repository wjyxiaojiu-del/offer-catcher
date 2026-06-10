"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { safeSetItem, safeGetJSON } from "@/lib/ui-utils"
import type { Task } from "@/lib/agent/types"

export interface ChatMessage {
  id: string
  role: "user" | "agent"
  content: string
  thinking?: string[]
  tasks?: Task[]
  matches?: any[]
  timestamp: number
}

export interface Session {
  id: string
  title: string
  messages: ChatMessage[]
  updatedAt: number
}

interface UseChatSessionsOptions {
  storageKey: string
  maxSessions?: number
}

function normalizeMessage(value: unknown, index: number): ChatMessage | null {
  if (!value || typeof value !== "object") return null
  const message = value as Partial<ChatMessage>
  if (message.role !== "user" && message.role !== "agent") return null

  return {
    id: typeof message.id === "string" && message.id ? message.id : `message-${index}`,
    role: message.role,
    content: typeof message.content === "string" ? message.content : "",
    thinking: Array.isArray(message.thinking)
      ? message.thinking.filter((step): step is string => typeof step === "string")
      : undefined,
    tasks: Array.isArray(message.tasks) ? message.tasks : undefined,
    matches: Array.isArray(message.matches) ? message.matches : undefined,
    timestamp: typeof message.timestamp === "number" && Number.isFinite(message.timestamp)
      ? message.timestamp
      : Date.now(),
  }
}

export function normalizeChatSessions(value: unknown): Session[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry, sessionIndex) => {
    if (!entry || typeof entry !== "object") return []
    const session = entry as Partial<Session>
    const messages = Array.isArray(session.messages)
      ? session.messages
          .map((message, messageIndex) => normalizeMessage(message, messageIndex))
          .filter((message): message is ChatMessage => message !== null)
      : []

    return [{
      id: typeof session.id === "string" && session.id ? session.id : `session-${sessionIndex}`,
      title: typeof session.title === "string" && session.title ? session.title : "历史会话",
      messages,
      updatedAt: typeof session.updatedAt === "number" && Number.isFinite(session.updatedAt)
        ? session.updatedAt
        : Date.now(),
    }]
  })
}

/**
 * Manages chat session list + currently-active session, persisted to
 * localStorage. Pulled out of agent/page.tsx so the 721-line component
 * doesn't have to interleave session CRUD with rendering.
 *
 * Hardening vs the inline original:
 * - localStorage writes go through safeSetItem (catches QuotaExceededError)
 * - reads use safeGetJSON (no try/catch needed in callers)
 */
export function useChatSessions({ storageKey, maxSessions = 20 }: UseChatSessionsOptions) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const hydratedRef = useRef(false)

  // Hydrate once from localStorage
  useEffect(() => {
    const parsed = normalizeChatSessions(safeGetJSON<unknown>(storageKey, []))
    safeSetItem(storageKey, JSON.stringify(parsed))
    if (parsed.length > 0) {
      setSessions(parsed)
      setCurrentSessionId(parsed[0].id)
      setMessages(parsed[0].messages)
    }
    hydratedRef.current = true
  }, [storageKey])

  // Persist on change (after hydration; otherwise we'd nuke storage on mount)
  useEffect(() => {
    if (!hydratedRef.current) return
    if (sessions.length > 0) {
      safeSetItem(storageKey, JSON.stringify(sessions))
    }
  }, [sessions, storageKey])

  const createSession = useCallback(() => {
    const newSession: Session = {
      id: crypto.randomUUID(),
      title: "新对话",
      messages: [],
      updatedAt: Date.now(),
    }
    setSessions((prev) => [newSession, ...prev].slice(0, maxSessions))
    setCurrentSessionId(newSession.id)
    setMessages([])
    return newSession.id
  }, [maxSessions])

  const switchSession = useCallback(
    (id: string) => {
      const session = sessions.find((s) => s.id === id)
      if (session) {
        setCurrentSessionId(id)
        setMessages(session.messages)
      }
    },
    [sessions]
  )

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id)
        if (id === currentSessionId) {
          if (next.length > 0) {
            setCurrentSessionId(next[0].id)
            setMessages(next[0].messages)
          } else {
            setCurrentSessionId("")
            setMessages([])
          }
        }
        return next
      })
    },
    [currentSessionId]
  )

  const updateCurrentSession = useCallback(
    (newMessages: ChatMessage[]) => {
      setMessages(newMessages)
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === currentSessionId)
        if (idx === -1) return prev
        const next = [...prev]
        const inferred = newMessages.find((m) => m.role === "user")?.content.slice(0, 20) || "新对话"
        next[idx] = {
          ...next[idx],
          messages: newMessages,
          title: next[idx].title === "新对话" ? inferred : next[idx].title,
          updatedAt: Date.now(),
        }
        return next
      })
    },
    [currentSessionId]
  )

  // Lets sendMessage seed a session before it's appeared in state — used
  // when sending the first message without a pre-created session.
  const ensureSession = useCallback(
    (titleHint: string): string => {
      if (currentSessionId) return currentSessionId
      const newSession: Session = {
        id: crypto.randomUUID(),
        title: titleHint.slice(0, 20) || "新对话",
        messages: [],
        updatedAt: Date.now(),
      }
      setSessions((prev) => [newSession, ...prev].slice(0, maxSessions))
      setCurrentSessionId(newSession.id)
      return newSession.id
    },
    [currentSessionId, maxSessions]
  )

  return {
    sessions,
    currentSessionId,
    messages,
    createSession,
    switchSession,
    deleteSession,
    updateCurrentSession,
    ensureSession,
  }
}
