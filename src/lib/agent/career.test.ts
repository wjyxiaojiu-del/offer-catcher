import { describe, it, expect } from "vitest"
import { buildCareerPrompt, buildGapAnalysisPrompt, buildRoadmapPrompt } from "./career"
import type { ParsedResume, Job } from "@/types"

function makeResume(overrides: Partial<ParsedResume> = {}): ParsedResume {
  return {
    name: "测试候选人",
    email: "test@example.com",
    phone: "13800138000",
    skills: [],
    skillGrades: [],
    education: [],
    experience: [],
    projects: [],
    rawText: "",
    source: "rule",
    ...overrides,
  }
}

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

describe("buildCareerPrompt", () => {
  it("includes resume skills and target job in prompt", () => {
    const resume = makeResume({ skills: ["React", "TypeScript"] })
    const job = makeJob({ title: "高级前端工程师", skills: ["React", "Vue", "Node.js"] })
    const { systemPrompt, userPrompt } = buildCareerPrompt(resume, job)
    expect(systemPrompt).toContain("职业规划")
    expect(userPrompt).toContain("React")
    expect(userPrompt).toContain("高级前端工程师")
    expect(userPrompt).toContain("Vue")
  })

  it("works without target job", () => {
    const resume = makeResume({ skills: ["Python"] })
    const { userPrompt } = buildCareerPrompt(resume)
    expect(userPrompt).toContain("Python")
  })
})

describe("buildGapAnalysisPrompt", () => {
  it("compares resume skills against job requirements", () => {
    const resume = makeResume({ skills: ["React", "HTML", "CSS"] })
    const job = makeJob({ skills: ["React", "Vue", "TypeScript", "Node.js"] })
    const { userPrompt } = buildGapAnalysisPrompt(resume, job)
    expect(userPrompt).toContain("React")
    expect(userPrompt).toContain("Vue")
    expect(userPrompt).toContain("差距")
  })
})

describe("buildRoadmapPrompt", () => {
  it("includes missing skills for learning roadmap", () => {
    const missingSkills = ["Vue", "TypeScript", "Node.js"]
    const { userPrompt } = buildRoadmapPrompt(missingSkills)
    expect(userPrompt).toContain("Vue")
    expect(userPrompt).toContain("TypeScript")
    expect(userPrompt).toContain("学习路线")
  })

  it("handles empty missing skills", () => {
    const { userPrompt } = buildRoadmapPrompt([])
    expect(userPrompt).toContain("提升")
  })
})
