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

  it("handles empty resume gracefully", () => {
    const resume = makeResume({ skills: [], rawText: "", education: [], experience: [] })
    const job = makeJob({ skills: ["React", "Vue"] })
    const results = matchResumeToJobs(resume, [job])
    expect(results).toHaveLength(1)
    expect(results[0].score).toBeLessThan(50)
    expect(results[0].matchLevel).toBe("weak")
  })

  it("handles job with zero skills", () => {
    const resume = makeResume({ skills: ["React"], rawText: "React developer" })
    const job = makeJob({ skills: [], requiredSkills: [], description: "" })
    const [r] = matchResumeToJobs(resume, [job])
    // Zero skills + empty description → no weighted items → default 50
    expect(r.skillMatch).toBe(50)
  })

  it("handles multiple jobs and sorts by score", () => {
    const resume = makeResume({ skills: ["React", "TypeScript"], rawText: "React TypeScript" })
    const jobs = [
      makeJob({ id: "a", skills: ["Python", "Django"] }),
      makeJob({ id: "b", skills: ["React", "TypeScript"] }),
      makeJob({ id: "c", skills: ["Vue"] }),
    ]
    const results = matchResumeToJobs(resume, jobs)
    expect(results).toHaveLength(3)
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
    }
  })
})

// ============================================================
// calculateWeights — dynamic weight strategies
// ============================================================

describe("calculateWeights", () => {
  it("triggers entry-level weight for '0-2年' experience", () => {
    const weights = calculateWeights(makeJob({ experience: "0-2年" }))
    expect(weights.skill).toBe(0.50)
    expect(weights.exp).toBe(0.10)
  })

  it("does NOT trigger entry-level weight for '10-15年' experience", () => {
    // "10-15年" contains "0-" as substring but should NOT be entry-level
    const weights = calculateWeights(makeJob({ experience: "10-15年" }))
    expect(weights.skill).toBe(0.45)  // default, NOT 0.50
    expect(weights.exp).toBe(0.20)    // default, NOT 0.10
  })

  it("triggers entry-level weight for '0~3年' (tilde separator)", () => {
    const weights = calculateWeights(makeJob({ experience: "0~3年" }))
    expect(weights.skill).toBe(0.50)
    expect(weights.exp).toBe(0.10)
  })

  it("uses default weights for '3-5年' experience", () => {
    const weights = calculateWeights(makeJob({ experience: "3-5年" }))
    expect(weights).toEqual({ skill: 0.45, edu: 0.15, exp: 0.20, project: 0.20 })
  })

  it("increases education weight for AI/research jobs", () => {
    const weights = calculateWeights(makeJob({ tags: ["AI"] }))
    expect(weights.edu).toBe(0.20)
    expect(weights.skill).toBe(0.40)
  })

  it("increases education weight for NLP tagged jobs", () => {
    const weights = calculateWeights(makeJob({ tags: ["NLP"] }))
    expect(weights.edu).toBe(0.20)
  })

  it("returns default weights for jobs with no special tags", () => {
    const weights = calculateWeights(makeJob({ tags: ["前端"], experience: "3-5年" }))
    expect(weights).toEqual({ skill: 0.45, edu: 0.15, exp: 0.20, project: 0.20 })
  })
})

// ============================================================
// generateOptimizationReport — section-level scoring
// ============================================================

describe("generateOptimizationReport", () => {
  it("returns 5 sections each with a numeric score and improvements", () => {
    const resume = makeResume({ skills: ["React"], rawText: "React developer" })
    const job = makeJob({ skills: ["React", "Vue"] })
    const report = generateOptimizationReport(resume, job)
    expect(report.sections).toHaveLength(5)
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

  it("scores relevant projects higher than irrelevant ones", () => {
    // Resume with React projects
    const relevantResume = makeResume({
      skills: ["React"],
      projects: [
        { name: "React Dashboard", description: "Built with React and TypeScript", techStack: ["React", "TypeScript"] },
      ],
    })
    // Resume with unrelated projects
    const irrelevantResume = makeResume({
      skills: ["Python"],
      projects: [
        { name: "Data Pipeline", description: "ETL pipeline with pandas", techStack: ["Python", "Pandas"] },
      ],
    })
    const job = makeJob({ skills: ["React", "TypeScript"] })
    const relevantReport = generateOptimizationReport(relevantResume, job)
    const irrelevantReport = generateOptimizationReport(irrelevantResume, job)
    const relevantProjectScore = relevantReport.sections.find(s => s.title === "项目经历")!.score
    const irrelevantProjectScore = irrelevantReport.sections.find(s => s.title === "项目经历")!.score
    expect(relevantProjectScore).toBeGreaterThan(irrelevantProjectScore)
  })

  it("rewards quantified project descriptions", () => {
    const quantifiedResume = makeResume({
      projects: [
        { name: "Perf Project", description: "性能提升 50%，日活 10 万用户", techStack: ["React"] },
      ],
    })
    const vagueResume = makeResume({
      projects: [
        { name: "Some Project", description: "参与了项目开发", techStack: ["React"] },
      ],
    })
    const job = makeJob({ skills: ["React"] })
    const quantReport = generateOptimizationReport(quantifiedResume, job)
    const vagueReport = generateOptimizationReport(vagueResume, job)
    const quantScore = quantReport.sections.find(s => s.title === "项目经历")!.score
    const vagueScore = vagueReport.sections.find(s => s.title === "项目经历")!.score
    expect(quantScore).toBeGreaterThan(vagueScore)
  })
})
