import type { ReactNode, JSX } from "react"

// ============ Markdown Renderer ============
// Lightweight inline + block markdown → React node converter. Pulled out of
// the agent page so it can be unit-tested and reused. Builds React nodes
// (no innerHTML), so LLM output is naturally XSS-safe.

export function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    const token = match[0]
    if (token.startsWith("`")) {
      nodes.push(
        <code key={`code-${key++}`} className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={`strong-${key++}`} className="font-semibold text-inherit">
          {token.slice(2, -2)}
        </strong>
      )
    } else {
      nodes.push(<em key={`em-${key++}`}>{token.slice(1, -1)}</em>)
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

export function renderMarkdown(text: string): JSX.Element {
  const lines = text.split("\n")
  const elements: JSX.Element[] = []
  let listItems: string[] = []
  let key = 0

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${key++}`} className="list-disc pl-5 space-y-1 my-2 text-sm">
          {listItems.map((item, i) => (
            <li key={i}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>
      )
      listItems = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.startsWith("- ") || trimmed.startsWith("• ") || /^\d+\./.test(trimmed)) {
      listItems.push(trimmed.replace(/^[-•\d.]+\s*/, ""))
    } else {
      flushList()
      if (trimmed.startsWith("### ")) {
        elements.push(
          <h3 key={`h3-${key++}`} className="font-bold text-base mt-3 mb-1">
            {renderInlineMarkdown(trimmed.slice(4))}
          </h3>
        )
      } else if (trimmed.startsWith("## ")) {
        elements.push(
          <h2 key={`h2-${key++}`} className="font-bold text-lg mt-4 mb-1">
            {renderInlineMarkdown(trimmed.slice(3))}
          </h2>
        )
      } else if (trimmed.startsWith("# ")) {
        elements.push(
          <h1 key={`h1-${key++}`} className="font-bold text-xl mt-4 mb-2">
            {renderInlineMarkdown(trimmed.slice(2))}
          </h1>
        )
      } else if (trimmed === "") {
        // skip
      } else {
        elements.push(
          <p key={`p-${key++}`} className="my-1.5 leading-relaxed text-sm">
            {renderInlineMarkdown(line)}
          </p>
        )
      }
    }
  }
  flushList()
  return <div>{elements}</div>
}
