// ============================================================
// Agent Core Type System
// ============================================================

export interface Tool {
  name: string
  description: string
  parameters: Record<string, { type: string; description: string; required?: boolean }>
  execute: (params: Record<string, unknown>) => Promise<unknown>
}

export interface ToolCall {
  tool: string
  params: Record<string, unknown>
  result?: unknown
  error?: string
  durationMs?: number
}

export type TaskStatus = "pending" | "running" | "completed" | "failed"

export interface Task {
  id: string
  name: string
  description: string
  status: TaskStatus
  agent: string
  dependencies: string[]
  params?: Record<string, unknown>
  result?: unknown
  error?: string
  startTime?: number
  endTime?: number
}

export interface AgentContext {
  sessionId: string
  userId?: string
  resume?: import("@/types").ParsedResume
  resumeId?: string
  memory: AgentMemory
  tasks: Task[]
  toolCalls: ToolCall[]
}

export interface AgentMemory {
  shortTerm: Record<string, unknown> // Session-level
  longTerm: Record<string, unknown>  // User-level persisted
}

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string
  toolCalls?: ToolCall[]
  timestamp: number
}

export interface AgentResponse {
  content: string
  tasks: Task[]
  toolCalls: ToolCall[]
  thinking?: string[]
}

export interface ReActStep {
  step: number
  thought: string
  action?: ToolCall
  observation?: string
}

export type UserIntent =
  | "match_jobs"       // 岗位匹配
  | "optimize_resume"  // 简历优化
  | "parse_resume"     // 解析简历
  | "apply_jobs"       // 投递岗位
  | "career_advice"    // 职业建议
  | "mock_interview"   // 模拟面试
  | "general_chat"     // 闲聊

export interface ParsedIntent {
  intent: UserIntent
  params: Record<string, unknown>
  confidence: number
}
