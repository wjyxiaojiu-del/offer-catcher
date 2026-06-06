import { describe, it, expect } from "vitest"
import {
  AutoApplyConfigSchema,
  AutoApplyBodySchema,
  JdOptimizeBodySchema,
  AgentChatBodySchema,
  BossBodySchema,
  ParsedResumeSchema,
} from "./schemas"

describe("ParsedResumeSchema", () => {
  it("defaults missing array fields to empty arrays", () => {
    const out = ParsedResumeSchema.parse({})
    expect(out.education).toEqual([])
    expect(out.experience).toEqual([])
    expect(out.skills).toEqual([])
    expect(out.projects).toEqual([])
    expect(out.name).toBe("")
  })

  it("preserves unknown fields (passthrough)", () => {
    const out = ParsedResumeSchema.parse({ name: "X", extraField: "kept" })
    expect((out as any).extraField).toBe("kept")
  })
})

describe("AutoApplyConfigSchema", () => {
  it("hydrates an empty object with all defaults", () => {
    const out = AutoApplyConfigSchema.parse({})
    expect(out.minScore).toBe(0)
    expect(out.maxApplications).toBe(10)
    expect(out.locations).toEqual([])
    expect(out.excludeCompanies).toEqual([])
  })

  it("clamps minScore to [0,100] (rejects out of range)", () => {
    expect(AutoApplyConfigSchema.safeParse({ minScore: 150 }).success).toBe(false)
    expect(AutoApplyConfigSchema.safeParse({ minScore: -1 }).success).toBe(false)
  })

  it("caps maxApplications at 100", () => {
    expect(AutoApplyConfigSchema.safeParse({ maxApplications: 101 }).success).toBe(false)
  })
})

describe("AutoApplyBodySchema", () => {
  it("preprocesses missing config to a fully-defaulted object", () => {
    const out = AutoApplyBodySchema.parse({ resume: { name: "X" } })
    expect(out.config.minScore).toBe(0)
    expect(out.config.locations).toEqual([])
  })

  it("preprocesses null config to defaults (not a crash)", () => {
    const out = AutoApplyBodySchema.parse({ resume: {}, config: null })
    expect(out.config.maxApplications).toBe(10)
  })
})

describe("JdOptimizeBodySchema", () => {
  it("rejects jdText shorter than 10 chars", () => {
    const result = JdOptimizeBodySchema.safeParse({ resume: {}, jdText: "短" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("JD 内容过短")
    }
  })

  it("accepts a sufficiently long jdText", () => {
    const out = JdOptimizeBodySchema.parse({ resume: {}, jdText: "this is a long enough jd text" })
    expect(out.jdText).toBe("this is a long enough jd text")
  })
})

describe("AgentChatBodySchema", () => {
  it("rejects empty messages", () => {
    expect(AgentChatBodySchema.safeParse({ message: "" }).success).toBe(false)
    expect(AgentChatBodySchema.safeParse({ message: "   " }).success).toBe(false)
  })

  it("caps message length at 8000 chars", () => {
    const long = "a".repeat(8001)
    expect(AgentChatBodySchema.safeParse({ message: long }).success).toBe(false)
  })

  it("trims whitespace", () => {
    const out = AgentChatBodySchema.parse({ message: "  hello  " })
    expect(out.message).toBe("hello")
  })
})

describe("BossBodySchema", () => {
  it("rejects unknown actions", () => {
    expect(BossBodySchema.safeParse({ action: "delete-everything" }).success).toBe(false)
  })

  it("accepts known actions", () => {
    for (const action of ["launch", "login-status", "wait-login", "search", "apply", "screenshot", "close"]) {
      expect(BossBodySchema.safeParse({ action }).success).toBe(true)
    }
  })
})
