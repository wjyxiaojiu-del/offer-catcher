import { describe, expect, it } from "vitest"
import { normalizeChatSessions } from "./useChatSessions"

describe("normalizeChatSessions", () => {
  it("returns an empty list for non-array storage values", () => {
    expect(normalizeChatSessions({ invalid: true })).toEqual([])
  })

  it("repairs legacy sessions without messages", () => {
    expect(normalizeChatSessions([{ id: "s1", title: "旧会话" }])).toEqual([
      expect.objectContaining({
        id: "s1",
        title: "旧会话",
        messages: [],
      }),
    ])
  })

  it("sanitizes malformed message fields", () => {
    const sessions = normalizeChatSessions([
      {
        id: "s1",
        title: "测试",
        messages: [
          {
            id: "m1",
            role: "agent",
            content: { invalid: true },
            thinking: "not-an-array",
            tasks: {},
            matches: {},
            timestamp: "bad",
          },
        ],
      },
    ])

    expect(sessions[0].messages[0]).toEqual(
      expect.objectContaining({
        id: "m1",
        role: "agent",
        content: "",
        thinking: undefined,
        tasks: undefined,
        matches: undefined,
      })
    )
    expect(Number.isFinite(sessions[0].messages[0].timestamp)).toBe(true)
  })
})
