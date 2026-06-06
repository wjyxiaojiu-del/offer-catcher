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
    const parsed = safeGetJSON<Session[]>(storageKey, [])
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
