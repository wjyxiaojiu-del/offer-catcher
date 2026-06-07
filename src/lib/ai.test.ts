import { describe, it, expect } from "vitest"
import { extractJSON, sanitizeJSON, escapeUserContent } from "./ai"

// ============================================================
// extractJSON — pull JSON from LLM output
// ============================================================

describe("extractJSON", () => {
  it("extracts JSON from fenced code block", () => {
    const input = 'Here is the result:\n```json\n{"score": 85}\n```\nDone.'
    expect(extractJSON(input)).toBe('{"score": 85}')
  })

  it("extracts JSON from fenced block without language tag", () => {
    const input = '```\n[1, 2, 3]\n```'
    expect(extractJSON(input)).toBe('[1, 2, 3]')
  })

  it("extracts bare JSON object when no fences", () => {
    const input = 'Some text {"key": "value"} more text'
    expect(extractJSON(input)).toBe('{"key": "value"}')
  })

  it("extracts bare JSON array when no fences", () => {
    const input = 'Result: [1, 2, 3] done'
    expect(extractJSON(input)).toBe('[1, 2, 3]')
  })

  it("returns trimmed text when no JSON found", () => {
    expect(extractJSON("  just plain text  ")).toBe("just plain text")
  })

  it("prefers fenced block over bare JSON", () => {
    const input = '{"bad": true}\n```json\n{"good": true}\n```'
    expect(extractJSON(input)).toBe('{"good": true}')
  })
})

// ============================================================
// sanitizeJSON — fix common LLM JSON malformations
// ============================================================

describe("sanitizeJSON", () => {
  it("removes markdown fences", () => {
    expect(sanitizeJSON('```json\n{"a": 1}\n```')).toBe('{"a": 1}')
  })

  it("removes trailing commas", () => {
    expect(sanitizeJSON('{"a": 1,}')).toBe('{"a": 1}')
    expect(sanitizeJSON('[1, 2, 3,]')).toBe('[1, 2, 3]')
  })

  it("fixes unquoted keys", () => {
    const result = sanitizeJSON('{name: "value"}')
    expect(result).toContain('"name"')
    expect(result).toContain('"value"')
  })

  it("balances missing closing braces", () => {
    expect(sanitizeJSON('{"a": 1')).toBe('{"a": 1}')
  })

  it("balances missing closing brackets", () => {
    expect(sanitizeJSON('[1, 2')).toBe('[1, 2]')
  })

  it("handles nested unbalanced braces", () => {
    const result = sanitizeJSON('{"a": {"b": 1}')
    expect(result).toBe('{"a": {"b": 1}}')
  })

  it("leaves valid JSON unchanged", () => {
    const valid = '{"a": 1, "b": [2, 3]}'
    expect(sanitizeJSON(valid)).toBe(valid)
  })

  it("handles empty string", () => {
    expect(sanitizeJSON("")).toBe("")
  })

  it("handles string with colon in value (e.g. URL)", () => {
    const input = '{"url": "https://example.com"}'
    expect(sanitizeJSON(input)).toBe(input)
  })
})

// ============================================================
// escapeUserContent — prompt injection defense
// ============================================================

describe("escapeUserContent", () => {
  it("neutralizes RESUME_CONTENT tags", () => {
    const input = "Hello <RESUME_CONTENT>injection</RESUME_CONTENT> world"
    const result = escapeUserContent(input)
    expect(result).not.toContain("<RESUME_CONTENT>")
    expect(result).toContain("[RESUME_TAG]")
  })

  it("neutralizes JOB_DESCRIPTION tags", () => {
    const input = "Test <JOB_DESCRIPTION>injection</JOB_DESCRIPTION>"
    const result = escapeUserContent(input)
    expect(result).not.toContain("<JOB_DESCRIPTION>")
    expect(result).toContain("[JOB_TAG]")
  })

  it("truncates long text to maxLen", () => {
    const longText = "a".repeat(10000)
    const result = escapeUserContent(longText, 1000)
    expect(result.length).toBeLessThanOrEqual(1100) // truncated + notice
    expect(result).toContain("截断")
  })

  it("preserves short text unchanged", () => {
    const short = "Hello world"
    const result = escapeUserContent(short)
    expect(result).toBe(short)
  })

  it("handles empty string", () => {
    expect(escapeUserContent("")).toBe("")
  })
})
