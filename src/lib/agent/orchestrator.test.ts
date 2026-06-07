import { describe, it, expect } from "vitest"
import { recognizeIntent } from "./orchestrator"
import type { AgentContext } from "./types"

function makeCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    sessionId: "test-session",
    memory: { shortTerm: {}, longTerm: {} },
    tasks: [],
    toolCalls: [],
    ...overrides,
  }
}

describe("recognizeIntent (rule-based path)", () => {
  it("recognizes match_jobs intent", async () => {
    const ctx = makeCtx()
    const intent = await recognizeIntent("帮我匹配岗位", ctx)
    expect(intent.intent).toBe("match_jobs")
    expect(intent.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it("recognizes parse_resume intent", async () => {
    const ctx = makeCtx()
    const intent = await recognizeIntent("解析我的简历", ctx)
    expect(intent.intent).toBe("parse_resume")
  })

  it("recognizes optimize_resume intent", async () => {
    const ctx = makeCtx()
    const intent = await recognizeIntent("帮我优化简历", ctx)
    expect(intent.intent).toBe("optimize_resume")
  })

  it("recognizes apply_jobs intent", async () => {
    const ctx = makeCtx()
    const intent = await recognizeIntent("帮我投递岗位", ctx)
    expect(intent.intent).toBe("apply_jobs")
  })

  it("recognizes mock_interview intent", async () => {
    const ctx = makeCtx()
    const intent = await recognizeIntent("帮我准备面试", ctx)
    expect(intent.intent).toBe("mock_interview")
  })

  it("recognizes career_advice intent", async () => {
    const ctx = makeCtx()
    const intent = await recognizeIntent("我的职业发展方向是什么", ctx)
    expect(intent.intent).toBe("career_advice")
  })

  it("extracts tags from match_jobs input", async () => {
    const ctx = makeCtx()
    const intent = await recognizeIntent("帮我找前端工作", ctx)
    expect(intent.intent).toBe("match_jobs")
    expect(intent.params?.tags).toContain("前端")
  })

  it("falls back to match_jobs when resume exists and input is ambiguous", async () => {
    const ctx = makeCtx({ resume: { name: "张三" } as any })
    const intent = await recognizeIntent("还有什么推荐吗", ctx)
    expect(intent.intent).toBe("match_jobs")
  })

  it("falls back to general_chat when no resume and input is ambiguous", async () => {
    const ctx = makeCtx()
    const intent = await recognizeIntent("你好", ctx)
    expect(intent.intent).toBe("general_chat")
  })
})
