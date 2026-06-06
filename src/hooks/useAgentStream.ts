"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { Task } from "@/lib/agent/types"

interface StreamResult {
  content: string
  thinking: string[]
  tasks: Task[]
  matches: any[]
}

interface SendOptions {
  message: string
  sessionId: string
  resumeText?: string
}

/**
 * Streams /api/agent/chat SSE events and returns the final composed result.
 *
 * Hardening vs the inline original:
 * - AbortController is created per request AND on unmount the in-flight
 *   request is aborted (was previously created but never aborted, leaking
 *   network + producing "setState after unmount" warnings).
 */
export function useAgentStream() {
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Abort the in-flight request when the consumer unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const sendMessage = useCallback(async ({ message, sessionId, resumeText }: SendOptions): Promise<StreamResult> => {
    // Cancel any prior in-flight request — rapid retries shouldn't race.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)

    const thinkingSteps: string[] = []
    let agentContent = ""
    let agentTasks: Task[] = []
    let agentMatches: any[] = []

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() || "你好", sessionId, resumeText }),
        signal: controller.signal,
      })

      if (!res.body) throw new Error("无响应体")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          if (line.startsWith("event: ")) {
            const eventType = line.slice(7)
            const dataLine = lines[i + 1]
            if (dataLine?.startsWith("data: ")) {
              try {
                const data = JSON.parse(dataLine.slice(6))
                if (eventType === "thinking") {
                  thinkingSteps.push(data.text)
                } else if (eventType === "task") {
                  const existing = agentTasks.find((t) => t.id === data.taskId)
                  if (existing) {
                    existing.status = data.status
                  } else {
                    agentTasks.push({
                      id: data.taskId,
                      name: data.name || data.taskId,
                      description: "",
                      status: data.status,
                      agent: data.agent,
                      dependencies: [],
                    })
                  }
                } else if (eventType === "result") {
                  agentContent = data.content || ""
                  agentTasks = data.tasks || agentTasks
                  agentMatches = data.matches ?? agentMatches
                } else if (eventType === "error") {
                  agentContent = `⚠️ ${data.message || "出错了"}`
                }
              } catch {
                // ignore parse errors
              }
              i++ // skip the data line we just consumed
            }
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        agentContent = "⚠️ 连接失败，请检查网络后重试。"
      }
    } finally {
      setIsLoading(false)
      abortRef.current = null
    }

    return {
      content: agentContent,
      thinking: thinkingSteps,
      tasks: agentTasks,
      matches: agentMatches,
    }
  }, [])

  return { isLoading, sendMessage }
}
