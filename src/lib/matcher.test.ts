import { describe, it, expect } from "vitest"
import { matchResumeToJobs, generateOptimizationReport, calculateWeights } from "./matcher"
import type { ParsedResume, Job } from "@/types"

// ============================================================
// Test fixtures
// ============================================================

function makeResume(overrides: Partial<ParsedResume> = {}): ParsedResume {
  return {
    name: "测试候选人",
    email: "test@example.com",
    phone: "13800138000",
    skills: [],
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

// ============================================================
// matchResumeToJobs — core matching engine
// ============================================================

describe("matchResumeToJobs", () => {
  it("returns one MatchResult per job, sorted descending by score", () => {
    const resume = makeResume({ skills: ["React", "TypeScript"], rawText: "React TypeScript" })
    const jobs = [
      makeJob({ id: "low", skills: ["Rust", "Kubernetes"] }),
      makeJob({ id: "high", skills: ["React", "TypeScript"] }),
    ]
    const results = matchResumeToJobs(resume, jobs)
    expect(results).toHaveLength(2)
    expect(results[0].job.id).toBe("high")
    expect(results[0].score).toBeGreaterThan(results[1].score)
  })

  it("matches synonyms (React ↔ ReactJS)", () => {
    const resume = makeResume({ skills: ["ReactJS"], rawText: "ReactJS" })
    const job = makeJob({ skills: ["React"] })
    const [r] = matchResumeToJobs(resume, [job])
    expect(r.matchedSkills).toContain("React")
    expect(r.missingSkills).not.toContain("React")
  })

  it("does NOT confuse Java with JavaScript (length-guard against substring contamination)", () => {
    const resume = makeResume({ skills: ["Java"], rawText: "Java backend developer" })
    const job = makeJob({ skills: ["JavaScript"] })
    const [r] = matchResumeToJobs(resume, [job])
    // Java should not match JavaScript even though "java" is a substring
    expect(r.matchedSkills).not.toContain("JavaScript")
    expect(r.missingSkills).toContain("JavaScript")
  })

  it("tolerates typos via Levenshtein (Pythn ≈ Python)", () => {
    const resume = makeResume({ skills: ["Pythn"], rawText: "Pythn developer" })
    const job = makeJob({ skills: ["Python"] })
    const [r] = matchResumeToJobs(resume, [job])
    expect(r.matchedSkills).toContain("Python")
  })

  it("clamps score to [0, 100]", () => {
    const resume = makeResume({
      skills: ["React", "TypeScript", "Node", "Docker", "K8s"],
      rawText: "React TypeScript Node Docker Kubernetes 5年经验 985 计算机硕士",
      education: [{ school: "清华大学", major: "CS", degree: "硕士", year: "2020" }],
      experience: [{ company: "Big Co", title: "Senior", duration: "2020.01-2025.01", description: "..." }],
    })
    const job = makeJob({ skills: ["React", "TypeScript"], experience: "1-3年" })
    const [r] = matchResumeToJobs(resume, [job])
    expect(r.score).toBeLessThanOrEqual(100)
    expect(r.score).toBeGreaterThanOrEqual(0)
  })

  it("assigns matchLevel buckets correctly", () => {
    const resume = makeResume({ skills: [], rawText: "" })
    const job = makeJob({ skills: ["React", "Vue", "Angular"] })
    const [r] = matchResumeToJobs(resume, [job])
    // Empty resume should be 'weak' (< 40)
    expect(r.matchLevel).toBe("weak")
  })

  it("rewards 985/211 school tier in education match", () => {
    const baseResume = makeResume({ education: [{ school: "普通本科", major: "CS", degree: "本科", year: "2024" }] })
    const tierResume = makeResume({ education: [{ school: "985 清华大学", major: "CS", degree: "本科", year: "2024" }] })
    const job = makeJob({ education: "本科及以上" })
    const [base] = matchResumeToJobs(baseResume, [job])
    const [tier] = matchResumeToJobs(tierResume, [job])
    expect(tier.educationMatch).toBeGreaterThanOrEqual(base.educationMatch)
  })

  it("does NOT give school bonus for non-prestigious 'University' substring", () => {
    // "野鸡大学 University" should NOT get the school tier bonus
    const fakeResume = makeResume({ education: [{ school: "野鸡大学 University", major: "CS", degree: "本科", year: "2024" }] })
    const normalResume = makeResume({ education: [{ school: "普通学院", major: "CS", degree: "本科", year: "2024" }] })
    const job = makeJob({ education: "本科及以上" })
    const [fake] = matchResumeToJobs(fakeResume, [job])
    const [normal] = matchResumeToJobs(normalResume, [job])
    // Both should have the same education score — "University" substring should not add bonus
    expect(fake.educationMatch).toBe(normal.educationMatch)
  })

  it("still rewards 985 schools like 清华大学", () => {
    const tsinghua = makeResume({ education: [{ school: "清华大学", major: "CS", degree: "本科", year: "2024" }] })
    const normal = makeResume({ education: [{ school: "普通学院", major: "CS", degree: "本科", year: "2024" }] })
    const job = makeJob({ education: "本科及以上" })
    const [t] = matchResumeToJobs(tsinghua, [job])
    const [n] = matchResumeToJobs(normal, [job])
    expect(t.educationMatch).toBeGreaterThan(n.educationMatch)
  })

  it("returns matched + missing that together cover all required skills", () => {
    const resume = makeResume({ skills: ["React"], rawText: "React" })
    const job = makeJob({ skills: ["React", "Vue", "Angular"] })
    const [r] = matchResumeToJobs(resume, [job])
    expect(r.matchedSkills.length + r.missingSkills.length).toBe(3)
  })

  // --- Dynamic weight: entry-level detection ---

  it("triggers entry-level weight for '0-2年' experience", () => {
    const weights = calculateWeights(makeJob({ experience: "0-2年" }))
    expect(weights.skill).toBe(0.45)
    expect(weights.exp).toBe(0.10)
  })

  it("does NOT trigger entry-level weight for '10-15年' experience", () => {
    // "10-15年" contains "0-" as substring but should NOT be entry-level
    const weights = calculateWeights(makeJob({ experience: "10-15年" }))
    expect(weights.skill).toBe(0.40)  // default, NOT 0.45
    expect(weights.exp).toBe(0.15)    // default, NOT 0.10
  })

  it("triggers entry-level weight for '0~3年' (tilde separator)", () => {
    const weights = calculateWeights(makeJob({ experience: "0~3年" }))
    expect(weights.skill).toBe(0.45)
    expect(weights.exp).toBe(0.10)
  })

  it("uses default weights for '3-5年' experience", () => {
    const weights = calculateWeights(makeJob({ experience: "3-5年" }))
    expect(weights).toEqual({ skill: 0.40, edu: 0.20, exp: 0.15, kw: 0.25 })
  })
})

// ============================================================
// generateOptimizationReport — section-level scoring
// ============================================================

describe("generateOptimizationReport", () => {
  it("returns 6 sections each with a numeric score and improvements", () => {
    const resume = makeResume({ skills: ["React"], rawText: "React developer" })
    const job = makeJob({ skills: ["React", "Vue"] })
    const report = generateOptimizationReport(resume, job)
    expect(report.sections).toHaveLength(6)
    for (const s of report.sections) {
      expect(typeof s.score).toBe("number")
      expect(s.score).toBeGreaterThanOrEqual(0)
      expect(s.score).toBeLessThanOrEqual(100)
      expect(Array.isArray(s.improvements)).toBe(true)
    }
  })

  it("overall score is the average of section scores", () => {
    const resume = makeResume({ skills: ["React"], rawText: "React" })
    const job = makeJob({ skills: ["React"] })
    const report = generateOptimizationReport(resume, job)
    const avg = Math.round(
      report.sections.reduce((a, s) => a + s.score, 0) / report.sections.length
    )
    expect(report.overallScore).toBe(avg)
  })

  it("flags incomplete resume (no name / contact / education)", () => {
    const resume = makeResume({ name: "未知", email: "", phone: "", education: [] })
    const job = makeJob()
    const report = generateOptimizationReport(resume, job)
    const completeness = report.sections.find((s) => s.title === "简历完整性")
    expect(completeness).toBeDefined()
    expect(completeness!.score).toBeLessThan(100)
  })
})
