// ============================================================
// Career Agent — High-level conversational career advisor
// ============================================================

import type { AgentContext, AgentResponse } from "./types"
import { runAgent } from "./orchestrator"
import { getAllSessionMemory, getAllUserPreferences, getConversationHistory, saveSessionMemory } from "./memory"
import { multiAgentParseResume } from "./resume-agents"
import type { ParsedResume, MatchResult, OptimizationReport } from "@/types"

export interface CareerAgentConfig {
  sessionId: string
  userId?: string
}

export class CareerAgent {
  private ctx: AgentContext

  constructor(config: CareerAgentConfig) {
    this.ctx = {
      sessionId: config.sessionId,
      userId: config.userId,
      memory: { shortTerm: {}, longTerm: {} },
      tasks: [],
      toolCalls: [],
    }
  }

  async init(): Promise<void> {
    try {
      const [sessionMem, userPref, history] = await Promise.all([
        getAllSessionMemory(this.ctx.sessionId),
        this.ctx.userId ? getAllUserPreferences(this.ctx.userId) : Promise.resolve({}),
        getConversationHistory(this.ctx.sessionId, 10).catch(() => []),
      ])
      this.ctx.memory.shortTerm = sessionMem
      this.ctx.memory.longTerm = userPref
      this.ctx.memory.shortTerm["_history"] = history

      // 从 session memory 恢复简历
      if (sessionMem.resume) {
        this.ctx.resume = sessionMem.resume as ParsedResume
      }
      // 从 session memory 恢复匹配结果
      if (sessionMem.lastMatches) {
        this.ctx.memory.shortTerm["lastMatches"] = sessionMem.lastMatches
      }
    } catch (err) {
      console.warn("CareerAgent init failed:", err)
      // Graceful: continue with empty memory
    }
  }

  async chat(userInput: string): Promise<AgentResponse> {
    try {
      return await runAgent(userInput, this.ctx)
    } catch (err) {
      console.error("CareerAgent chat failed:", err)
      return {
        content: "抱歉，服务暂时出错了，请稍后重试。",
        tasks: this.ctx.tasks,
        toolCalls: this.ctx.toolCalls,
        thinking: ["执行过程中发生错误"],
      }
    }
  }

  async parseResume(text: string): Promise<ParsedResume> {
    try {
      const result = await multiAgentParseResume(text)
      this.ctx.resume = result.resume
      // 持久化简历到 session memory
      await saveSessionMemory(this.ctx.sessionId, "resume", result.resume)
      return result.resume
    } catch (err) {
      console.error("CareerAgent parseResume failed:", err)
      // Fallback to rule-based parser
      const { parseResume } = await import("@/lib/resume-parser")
      const fallback = parseResume(text)
      this.ctx.resume = fallback
      // 持久化简历到 session memory
      await saveSessionMemory(this.ctx.sessionId, "resume", fallback)
      return fallback
    }
  }

  async matchJobs(filter?: { tags?: string[]; topN?: number }): Promise<MatchResult[]> {
    try {
      if (!this.ctx.resume) {
        throw new Error("请先解析简历")
      }
      const { matchResumeToJobs } = await import("@/lib/matcher")
      const { getAllJobs } = await import("@/lib/job-service")

      // 从数据库或内置数据获取岗位
      let targetJobs = await getAllJobs()

      // 按标签筛选
      if (filter?.tags && filter.tags.length > 0) {
        targetJobs = targetJobs.filter((j) =>
          filter.tags!.some(
            (tag) => j.tags.includes(tag) || j.title.includes(tag) || j.description.includes(tag)
          )
        )
      }

      const results = matchResumeToJobs(this.ctx.resume, targetJobs)
      // 持久化匹配结果到 session memory
      await saveSessionMemory(this.ctx.sessionId, "lastMatches", results.slice(0, 10))
      return filter?.topN ? results.slice(0, filter.topN) : results
    } catch (err) {
      console.error("CareerAgent matchJobs failed:", err)
      return []
    }
  }

  async optimizeForJob(jobId: string): Promise<OptimizationReport> {
    try {
      if (!this.ctx.resume) {
        throw new Error("请先解析简历")
      }
      const { generateOptimizationReport } = await import("@/lib/matcher")
      const { getAllJobs } = await import("@/lib/job-service")
      const jobs = await getAllJobs()
      const job = jobs.find((j) => j.id === jobId)
      if (!job) {
        throw new Error(`未找到岗位: ${jobId}`)
      }
      return generateOptimizationReport(this.ctx.resume, job)
    } catch (err) {
      console.error("CareerAgent optimizeForJob failed:", err)
      return {
        overallScore: 0,
        overall: "生成优化报告失败，请稍后重试。",
        sections: [],
      }
    }
  }

  setResume(resume: ParsedResume): void {
    this.ctx.resume = resume
  }

  getResume(): ParsedResume | undefined {
    return this.ctx.resume
  }

  async getMemory(): Promise<Record<string, unknown>> {
    return {
      shortTerm: this.ctx.memory.shortTerm,
      longTerm: this.ctx.memory.longTerm,
      resume: this.ctx.resume,
      tasks: this.ctx.tasks,
    }
  }
}
