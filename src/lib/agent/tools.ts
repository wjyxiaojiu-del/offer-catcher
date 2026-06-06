// ============================================================
// Tool Registry — All tools that Agents can call
// ============================================================

import type { Tool, AgentContext } from "./types"
import { parseResume } from "@/lib/resume-parser"
import { matchResumeToJobs, generateOptimizationReport } from "@/lib/matcher"
import { aiAnalyzeMatch } from "@/lib/ai"
import { withTimeout } from "@/lib/utils"
import { jobs } from "@/data/jobs"
import { saveSessionMemory, getSessionMemory, saveUserPreference, getUserPreference } from "./memory"

export function createToolRegistry(ctx: AgentContext): Record<string, Tool> {
  return {
    // ======== Resume Tools ========
    parseResumeText: {
      name: "parseResumeText",
      description: "从简历文本中提取结构化信息（姓名、技能、教育、经历、项目）",
      parameters: {
        text: { type: "string", description: "简历原始文本", required: false },
      },
      execute: async ({ text }) => {
        const sourceText = (typeof text === "string" ? text : "") || ctx.resume?.rawText || ""
        if (!sourceText.trim()) throw new Error("简历文本不能为空")
        const result = parseResume(sourceText)
        ctx.resume = result
        return {
          name: result.name,
          skills: result.skills,
          education: result.education,
          experience: result.experience,
          projects: result.projects,
          skillCount: result.skills.length,
          expCount: result.experience.length,
          eduCount: result.education.length,
        }
      },
    },

    // ======== Matching Tools ========
    matchJobs: {
      name: "matchJobs",
      description: "将简历与岗位库进行多维度匹配，返回排序后的匹配结果",
      parameters: {
        filterTags: { type: "string[]", description: "按标签筛选（如 ['AI','前端']）", required: false },
        topN: { type: "number", description: "返回前N个结果", required: false },
      },
      execute: async ({ filterTags, topN }) => {
        if (!ctx.resume) throw new Error("请先解析简历")
        let targetJobs = jobs
        if (Array.isArray(filterTags) && filterTags.length > 0) {
          targetJobs = jobs.filter(j =>
            filterTags.some((tag: string) =>
              j.tags.includes(tag) || j.title.includes(tag) || j.description.includes(tag)
            )
          )
        }
        const results = matchResumeToJobs(ctx.resume, targetJobs)
        const sliced = typeof topN === "number" ? results.slice(0, topN) : results
        return sliced.map(r => ({
          jobId: r.job.id,
          title: r.job.title,
          company: r.job.company,
          score: r.score,
          matchLevel: r.matchLevel,
          matchedSkills: r.matchedSkills,
          missingSkills: r.missingSkills,
          suggestions: r.suggestions,
          location: r.job.location,
          salary: r.job.salary,
        }))
      },
    },

    generateOptimizationReport: {
      name: "generateOptimizationReport",
      description: "针对特定岗位生成简历优化报告",
      parameters: {
        jobId: { type: "string", description: "岗位ID", required: true },
      },
      execute: async ({ jobId }) => {
        if (!ctx.resume) throw new Error("请先解析简历")
        const job = jobs.find(j => j.id === jobId)
        if (!job) throw new Error(`未找到岗位: ${jobId}`)
        const report = generateOptimizationReport(ctx.resume, job)
        return report
      },
    },

    // ======== Search Tools ========
    searchJobs: {
      name: "searchJobs",
      description: "根据关键词搜索岗位库",
      parameters: {
        keyword: { type: "string", description: "搜索关键词", required: true },
        limit: { type: "number", description: "返回数量上限", required: false },
      },
      execute: async ({ keyword, limit }) => {
        const kw = String(keyword).toLowerCase()
        const matched = jobs
          .filter(j =>
            j.title.toLowerCase().includes(kw) ||
            j.company.toLowerCase().includes(kw) ||
            j.tags.some(t => t.toLowerCase().includes(kw)) ||
            j.skills.some(s => s.toLowerCase().includes(kw)) ||
            j.description.toLowerCase().includes(kw)
          )
          .slice(0, typeof limit === "number" ? limit : 10)
        return matched.map(j => ({
          jobId: j.id,
          title: j.title,
          company: j.company,
          location: j.location,
          salary: j.salary,
          tags: j.tags,
          skills: j.skills,
        }))
      },
    },

    getJobDetail: {
      name: "getJobDetail",
      description: "获取岗位详细信息",
      parameters: {
        jobId: { type: "string", description: "岗位ID", required: true },
      },
      execute: async ({ jobId }) => {
        const job = jobs.find(j => j.id === jobId)
        if (!job) throw new Error(`未找到岗位: ${jobId}`)
        return job
      },
    },

    // ======== Memory Tools ========
    saveMemory: {
      name: "saveMemory",
      description: "保存信息到Agent记忆（用户偏好、历史上下文）",
      parameters: {
        key: { type: "string", description: "记忆键名", required: true },
        value: { type: "any", description: "记忆值", required: true },
        scope: { type: "string", description: "记忆范围: session | user", required: false },
      },
      execute: async ({ key, value, scope }) => {
        const s = String(scope || "session")
        if (s === "user" && ctx.userId) {
          await saveUserPreference(ctx.userId, String(key), value)
        } else {
          await saveSessionMemory(ctx.sessionId, String(key), value)
        }
        ctx.memory.shortTerm[String(key)] = value
        return { success: true, key, scope: s }
      },
    },

    recallMemory: {
      name: "recallMemory",
      description: "从Agent记忆中读取信息",
      parameters: {
        key: { type: "string", description: "记忆键名", required: true },
        scope: { type: "string", description: "记忆范围: session | user", required: false },
      },
      execute: async ({ key, scope }) => {
        const s = String(scope || "session")
        let value: unknown = null
        if (s === "user" && ctx.userId) {
          value = await getUserPreference(ctx.userId, String(key))
        } else {
          value = await getSessionMemory(ctx.sessionId, String(key))
        }
        return { key, value, found: value !== null && value !== undefined }
      },
    },

    // ======== Analysis Tools ========
    analyzeTopMatches: {
      name: "analyzeTopMatches",
      description: "对 Top N 匹配结果进行 AI 深度分析",
      parameters: {
        topN: { type: "number", description: "分析前N个结果，默认3", required: false },
      },
      execute: async ({ topN }) => {
        if (!ctx.resume) throw new Error("请先解析简历")
        const matchResults = (ctx.tasks.find(t => t.id === "match")?.result as any[]) || []
        const limit = typeof topN === "number" ? topN : 3
        const targets = matchResults.slice(0, limit)
        const analyses = []
        for (const m of targets) {
          const job = jobs.find(j => j.id === m.jobId)
          if (!job) continue
          const ai = await withTimeout(
            aiAnalyzeMatch(ctx.resume!, {
              title: job.title,
              company: job.company,
              description: job.description,
              requirements: job.requirements,
              skills: job.skills,
              education: job.education,
              experience: job.experience,
            }),
            5000,
            null,
            { silent: true }
          )
          analyses.push({ jobId: m.jobId, aiAnalysis: ai })
        }
        return analyses
      },
    },

    summarizeMatches: {
      name: "summarizeMatches",
      description: "汇总匹配结果和分析结果生成报告",
      parameters: {},
      execute: async () => {
        const matchResult = ctx.tasks.find(t => t.id === "match")?.result as any[]
        const analyzeResult = ctx.tasks.find(t => t.id === "analyze")?.result as any[]
        return { matches: matchResult, analyses: analyzeResult }
      },
    },

    advisor: {
      name: "advisor",
      description: "提供职业建议、简历优化、面试准备",
      parameters: {
        type: { type: "string", description: "建议类型: optimize | interview | career", required: true },
        jobId: { type: "string", description: "岗位ID（优化场景）", required: false },
      },
      execute: async ({ type, jobId }) => {
        if (type === "optimize") {
          if (!ctx.resume) throw new Error("请先解析简历")
          const matchTask = ctx.tasks.find(t => t.id === "match")
          const results = matchTask?.result as any[] | undefined
          const topMatch = results?.[0]
          const targetJobId = (jobId as string) || topMatch?.jobId
          if (!targetJobId) throw new Error("未找到目标岗位")
          const job = jobs.find(j => j.id === targetJobId)
          if (!job) throw new Error(`未找到岗位: ${targetJobId}`)
          return generateOptimizationReport(ctx.resume, job)
        }
        return { advice: "请告诉我更具体的需求，比如目标岗位或想优化的方向。" }
      },
    },

    // ======== Application Tools ========
    simulateApply: {
      name: "simulateApply",
      description: "模拟投递一个岗位",
      parameters: {
        jobId: { type: "string", description: "岗位ID", required: true },
      },
      execute: async ({ jobId }) => {
        const job = jobs.find(j => j.id === jobId)
        if (!job) throw new Error(`未找到岗位: ${jobId}`)
        // Simulated apply — in real world this would call an external API
        return {
          success: true,
          jobId,
          jobTitle: job.title,
          company: job.company,
          message: `已向 ${job.company} 的「${job.title}」岗位发送投递申请`,
          appliedAt: new Date().toISOString(),
        }
      },
    },
  }
}

export type ToolRegistry = ReturnType<typeof createToolRegistry>
