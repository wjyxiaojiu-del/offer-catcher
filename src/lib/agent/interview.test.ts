import { describe, it, expect } from "vitest"
import { detectInterviewType, buildInterviewPrompt, buildFollowUpPrompt, buildInterviewSummary } from "./interview"
import type { Job } from "@/types"

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "j1",
    title: "前端工程师",
    company: "测试公司",
    location: "北京",
    salary: "20-40k",
    experience: "1-3年",
    education: "本科及以上",
    description: "负责前端开发",
    requirements: [],
    skills: [],
    requiredSkills: [],
    niceToHaveSkills: [],
    tags: [],
    ...overrides,
  } as Job
}

describe("detectInterviewType", () => {
  it("detects technical interview for frontend job", () => {
    const job = makeJob({
      title: "前端工程师",
      skills: ["React", "TypeScript", "JavaScript"],
      description: "负责前端开发，熟悉 React 框架",
    })
    expect(detectInterviewType(job)).toBe("technical")
  })

  it("detects behavioral interview for PM job", () => {
    const job = makeJob({
      title: "产品经理",
      skills: ["需求分析", "用户研究"],
      description: "负责产品规划，协调跨部门沟通",
    })
    expect(detectInterviewType(job)).toBe("behavioral")
  })

  it("detects mixed interview for full-stack job", () => {
    const job = makeJob({
      title: "全栈工程师",
      skills: ["React", "Node.js", "项目管理"],
      description: "负责全栈开发和团队协作",
    })
    expect(detectInterviewType(job)).toBe("mixed")
  })

  it("defaults to mixed for truly ambiguous jobs", () => {
    const job = makeJob({ title: "实习生", skills: [], description: "协助团队完成日常工作" })
    expect(detectInterviewType(job)).toBe("mixed")
  })
})

describe("buildInterviewPrompt", () => {
  it("returns a system prompt and user prompt", () => {
    const job = makeJob({ title: "前端工程师", skills: ["React"] })
    const { systemPrompt, userPrompt } = buildInterviewPrompt(
      "technical",
      job,
      "张三\nReact developer\n3年经验"
    )
    expect(systemPrompt).toContain("面试")
    expect(userPrompt).toContain("前端工程师")
    expect(userPrompt).toContain("React")
  })

  it("includes resume context in user prompt", () => {
    const job = makeJob()
    const { userPrompt } = buildInterviewPrompt("behavioral", job, "张三\nPython developer")
    expect(userPrompt).toContain("张三")
  })
})

describe("buildFollowUpPrompt", () => {
  it("builds follow-up prompt with previous Q&A context", () => {
    const history = [
      { role: "interviewer" as const, content: "请介绍一下 React 的虚拟 DOM" },
      { role: "candidate" as const, content: "虚拟 DOM 是 React 的一种优化机制..." },
    ]
    const { userPrompt } = buildFollowUpPrompt(history, "technical")
    expect(userPrompt).toContain("虚拟 DOM")
    expect(userPrompt).toContain("追问")
  })
})

describe("buildInterviewSummary", () => {
  it("generates structured summary from Q&A history", () => {
    const history = [
      { role: "interviewer" as const, content: "请介绍一下 React 的虚拟 DOM" },
      { role: "candidate" as const, content: "虚拟 DOM 是 React 的一种优化机制..." },
      { role: "interviewer" as const, content: "回答不错，那 React 的生命周期呢？" },
      { role: "candidate" as const, content: "React 生命周期包括..." },
    ]
    const summary = buildInterviewSummary(history, "technical")
    expect(summary.totalQuestions).toBe(2)
    expect(summary.type).toBe("technical")
    expect(summary.history).toHaveLength(4)
  })
})
