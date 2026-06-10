import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>()
  return {
    ...actual,
    aiRecognizeIntent: vi.fn(async () => null),
    callLLM: vi.fn(async () => ""),
  }
})

import { recognizeIntent, parseReActResponse, runAgent } from "./orchestrator"
import { aiRecognizeIntent, callLLM } from "@/lib/ai"
import type { AgentContext } from "./types"

const mockedAiRecognizeIntent = vi.mocked(aiRecognizeIntent)
const mockedCallLLM = vi.mocked(callLLM)

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
    mockedAiRecognizeIntent.mockClear()
    const ctx = makeCtx()
    const intent = await recognizeIntent("帮我匹配岗位", ctx)
    expect(intent.intent).toBe("match_jobs")
    expect(intent.confidence).toBeGreaterThanOrEqual(0.9)
    expect(mockedAiRecognizeIntent).not.toHaveBeenCalled()
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
    mockedAiRecognizeIntent.mockClear()
    const ctx = makeCtx()
    const intent = await recognizeIntent("你好", ctx)
    expect(intent.intent).toBe("general_chat")
    expect(mockedAiRecognizeIntent).toHaveBeenCalledOnce()
  })
})

describe("parseReActResponse", () => {
  it("parses valid ReAct JSON", () => {
    const result = parseReActResponse(`{"thought":"需要解析简历","action":{"tool":"parseResumeText","params":{"text":"张三"}},"finish":false}`)
    expect(result).not.toBeNull()
    expect(result!.thought).toBe("需要解析简历")
    expect(result!.action.tool).toBe("parseResumeText")
    expect(result!.finish).toBe(false)
  })

  it("parses markdown-wrapped JSON", () => {
    const result = parseReActResponse("```json\n{\"thought\":\"完成\",\"action\":{\"tool\":\"finish\",\"params\":{}},\"finish\":true}\n```")
    expect(result).not.toBeNull()
    expect(result!.finish).toBe(true)
  })

  it("treats finish tool as finish=true", () => {
    const result = parseReActResponse(`{"thought":"完成","action":{"tool":"finish","params":{}},"finish":false}`)
    expect(result).not.toBeNull()
    expect(result!.finish).toBe(true)
  })

  it("returns null for invalid JSON", () => {
    const result = parseReActResponse("not json at all")
    expect(result).toBeNull()
  })

  it("returns null for missing thought", () => {
    const result = parseReActResponse(`{"action":{"tool":"finish","params":{}}}`)
    expect(result).toBeNull()
  })
})

describe("runAgent ReAct path", () => {
  it("uses ReAct loop when LLM returns valid actions", async () => {
    mockedCallLLM.mockResolvedValueOnce(`{"thought":"先解析简历","action":{"tool":"parseResumeText","params":{}},"finish":false}`)
    mockedCallLLM.mockResolvedValueOnce(`{"thought":"完成","action":{"tool":"finish","params":{}},"finish":true}`)

    const ctx = makeCtx({ resume: { name: "张三", skills: ["JavaScript"], rawText: "test" } as any })
    const response = await runAgent("帮我匹配岗位", ctx)

    expect(response.reactSteps).toBeDefined()
    expect(response.reactSteps!.length).toBeGreaterThanOrEqual(1)
    expect(response.content).toBeTruthy()
  })

  it("falls back to fixed DAG when ReAct LLM fails", async () => {
    mockedCallLLM.mockResolvedValue("") // Always empty

    const ctx = makeCtx()
    const response = await runAgent("你好", ctx)

    expect(response.content).toBeTruthy()
    expect(response.tasks.length).toBeGreaterThanOrEqual(1)
  })
})
