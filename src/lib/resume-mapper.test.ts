import { describe, it, expect } from "vitest"
import { dbResumeToParsed, buildResumeWriteData } from "./resume-mapper"
import type { ParsedResume } from "@/types"

function makeDbRecord(overrides: Partial<Parameters<typeof dbResumeToParsed>[0]> = {}) {
  return {
    id: "r1",
    name: "张三",
    email: "z@s.com",
    phone: "13800000000",
    rawText: "raw",
    source: "rule",
    summary: null,
    educations: [],
    experiences: [],
    projects: [],
    skills: [],
    ...overrides,
  }
}

describe("dbResumeToParsed", () => {
  it("coerces nullable string columns to undefined", () => {
    const out = dbResumeToParsed(
      makeDbRecord({
        educations: [{ school: "清华", major: "CS", degree: "本科", year: "2024", startYear: null, endYear: null, gpa: null }],
        experiences: [{ company: "X", title: "Y", duration: "1y", description: "d", startDate: null, endDate: null }],
      })
    )
    expect(out.education[0].startYear).toBeUndefined()
    expect(out.education[0].gpa).toBeUndefined()
    expect(out.experience[0].startDate).toBeUndefined()
  })

  it("parses techStack JSON safely; returns [] on malformed JSON", () => {
    const out = dbResumeToParsed(
      makeDbRecord({
        projects: [
          { name: "ok", description: "", techStack: '["React","TS"]' },
          { name: "bad", description: "", techStack: "not-json" },
          { name: "empty", description: "", techStack: "" },
        ],
      })
    )
    expect(out.projects[0].techStack).toEqual(["React", "TS"])
    expect(out.projects[1].techStack).toEqual([])
    expect(out.projects[2].techStack).toEqual([])
  })

  it("rejects non-array JSON in techStack (returns [])", () => {
    const out = dbResumeToParsed(
      makeDbRecord({
        projects: [{ name: "n", description: "", techStack: '"a string"' }],
      })
    )
    expect(out.projects[0].techStack).toEqual([])
  })

  it("normalizes source: anything other than 'ai' becomes 'rule'", () => {
    expect(dbResumeToParsed(makeDbRecord({ source: "ai" })).source).toBe("ai")
    expect(dbResumeToParsed(makeDbRecord({ source: "rule" })).source).toBe("rule")
    expect(dbResumeToParsed(makeDbRecord({ source: "unknown" })).source).toBe("rule")
  })

  it("maps skills to plain string array", () => {
    const out = dbResumeToParsed(makeDbRecord({ skills: [{ name: "React" }, { name: "TS" }] }))
    expect(out.skills).toEqual(["React", "TS"])
  })
})

describe("buildResumeWriteData", () => {
  const resume: ParsedResume = {
    name: "张三",
    email: "z@s.com",
    phone: "13800000000",
    skills: ["React"],
    skillGrades: [{ skill: "React", grade: "core" }],
    education: [{ school: "清华", major: "CS", degree: "本科", year: "2024" }],
    experience: [{ company: "X", title: "Y", duration: "1y", description: "d" }],
    projects: [{ name: "P", description: "", techStack: ["a", "b"] }],
    rawText: "raw",
    source: "rule",
  }

  it("produces nested create only when forUpdate is false (default)", () => {
    const data = buildResumeWriteData(resume)
    expect(data.educations).toEqual({ create: expect.any(Array) })
    expect((data.educations as any).deleteMany).toBeUndefined()
  })

  it("adds deleteMany before create when forUpdate=true", () => {
    const data = buildResumeWriteData(resume, { forUpdate: true })
    expect((data.educations as any).deleteMany).toEqual({})
    expect((data.experiences as any).deleteMany).toEqual({})
    expect((data.projects as any).deleteMany).toEqual({})
    expect((data.skills as any).deleteMany).toEqual({})
  })

  it("serializes techStack as JSON string", () => {
    const data = buildResumeWriteData(resume)
    const project = (data.projects as any).create[0]
    expect(project.techStack).toBe('["a","b"]')
  })

  it("defaults missing source to 'rule'", () => {
    const data = buildResumeWriteData({ ...resume, source: undefined })
    expect(data.source).toBe("rule")
  })
})
