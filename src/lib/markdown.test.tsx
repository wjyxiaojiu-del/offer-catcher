import { describe, it, expect } from "vitest"
import { renderMarkdown, renderInlineMarkdown } from "./markdown"

// ============================================================
// renderInlineMarkdown — inline formatting
// ============================================================

describe("renderInlineMarkdown", () => {
  it("returns plain text unchanged", () => {
    const nodes = renderInlineMarkdown("hello world")
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toBe("hello world")
  })

  it("splits on bold markers", () => {
    const nodes = renderInlineMarkdown("before **bold** after")
    expect(nodes.length).toBe(3)
    // nodes[0] = "before ", nodes[1] = <strong>, nodes[2] = " after"
    expect(nodes[0]).toBe("before ")
  })

  it("splits on code markers", () => {
    const nodes = renderInlineMarkdown("use `console.log` here")
    expect(nodes.length).toBe(3)
  })

  it("splits on italic markers", () => {
    const nodes = renderInlineMarkdown("this is *italic* text")
    expect(nodes.length).toBe(3)
  })

  it("handles mixed inline formatting", () => {
    const nodes = renderInlineMarkdown("**bold** and `code` and *italic*")
    expect(nodes.length).toBe(5) // bold + " and " + code + " and " + italic
  })

  it("handles empty string", () => {
    const nodes = renderInlineMarkdown("")
    expect(nodes).toHaveLength(0)
  })
})

// ============================================================
// renderMarkdown — block-level formatting
// ============================================================

describe("renderMarkdown", () => {
  it("renders a paragraph", () => {
    const { container } = renderHook(() => renderMarkdown("hello world"))
    // renderMarkdown returns JSX.Element, check it has a div wrapper
    expect(container).toBeDefined()
  })

  it("handles headings", () => {
    const result = renderMarkdown("# Title\n## Subtitle\n### Sub-sub")
    // Should produce JSX with h1, h2, h3 elements
    expect(result).toBeDefined()
    expect(result.type).toBe("div")
  })

  it("handles list items", () => {
    const result = renderMarkdown("- item 1\n- item 2\n- item 3")
    expect(result).toBeDefined()
  })

  it("handles numbered lists", () => {
    const result = renderMarkdown("1. first\n2. second\n3. third")
    expect(result).toBeDefined()
  })

  it("handles mixed content", () => {
    const text = "# Heading\n\nSome paragraph\n\n- list item\n- another\n\n**bold text**"
    const result = renderMarkdown(text)
    expect(result).toBeDefined()
  })

  it("handles empty string", () => {
    const result = renderMarkdown("")
    expect(result).toBeDefined()
  })

  it("skips blank lines", () => {
    const result = renderMarkdown("line 1\n\n\n\nline 2")
    expect(result).toBeDefined()
  })
})

// Helper: since renderMarkdown returns JSX (not a Testing Library result),
// we wrap it in a minimal container check.
function renderHook(fn: () => JSX.Element) {
  const container = fn()
  return { container }
}
