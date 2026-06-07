// ============================================================
// MinerU OCR Client — 扫描件 PDF 文字提取
// ============================================================
//
// 通过 MinerU REST API (POST /file_parse) 提取扫描件 PDF 中的文字。
// 需要部署 MinerU 服务：https://github.com/opendatalab/MinerU
//
// 环境变量：
//   MINERU_API_URL — MinerU 服务地址（如 http://localhost:8000）
//   MINERU_API_KEY — 可选 API Key

const MINERU_API_URL = process.env.MINERU_API_URL || ""
const MINERU_API_KEY = process.env.MINERU_API_KEY || ""
const MINERU_TIMEOUT_MS = 30_000

/**
 * Check if MinerU OCR service is configured.
 */
export function isMineruAvailable(): boolean {
  return !!MINERU_API_URL
}

/**
 * Extract text from a scanned PDF using MinerU's REST API.
 *
 * Calls POST /file_parse with the file as multipart/form-data.
 * Returns extracted text in Markdown format (converted to plain text).
 *
 * @throws Error if MinerU is not configured, timeout, or extraction fails.
 */
export async function mineruExtractText(
  fileBuffer: ArrayBuffer,
  filename: string
): Promise<string> {
  if (!MINERU_API_URL) {
    throw new Error("MinerU 未配置（MINERU_API_URL 未设置）")
  }

  const url = `${MINERU_API_URL.replace(/\/$/, "")}/file_parse`

  // Build multipart form data
  const formData = new FormData()
  const blob = new Blob([fileBuffer], { type: "application/pdf" })
  formData.append("file", blob, filename)

  const headers: Record<string, string> = {}
  if (MINERU_API_KEY) {
    headers["Authorization"] = `Bearer ${MINERU_API_KEY}`
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), MINERU_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(`MinerU API 返回 ${response.status}: ${text.slice(0, 200)}`)
    }

    const data = await response.json() as MineruResponse

    // MinerU returns results in various formats; extract text content
    return extractTextFromResponse(data)
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error(`MinerU OCR 超时（${MINERU_TIMEOUT_MS / 1000}秒）`)
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

// ========== MinerU Response Types ==========

interface MineruResponse {
  /** Extracted text in Markdown format */
  text?: string
  /** Alternative field name */
  markdown?: string
  /** Page-level results */
  pages?: Array<{ text?: string; markdown?: string }>
  /** Raw content */
  content?: string
  /** Nested result object */
  result?: { text?: string; markdown?: string }
}

/**
 * Extract text content from MinerU's response.
 * Handles multiple response formats (text, markdown, pages, content, result).
 */
function extractTextFromResponse(data: MineruResponse): string {
  // Direct text field
  if (data.text && data.text.trim().length > 0) {
    return mdToPlainText(data.text)
  }

  // Markdown field
  if (data.markdown && data.markdown.trim().length > 0) {
    return mdToPlainText(data.markdown)
  }

  // Nested result
  if (data.result?.text) {
    return mdToPlainText(data.result.text)
  }
  if (data.result?.markdown) {
    return mdToPlainText(data.result.markdown)
  }

  // Page-level results
  if (data.pages && data.pages.length > 0) {
    const texts = data.pages
      .map(p => p.text || p.markdown || "")
      .filter(t => t.trim().length > 0)
    if (texts.length > 0) {
      return mdToPlainText(texts.join("\n\n"))
    }
  }

  // Raw content
  if (data.content && data.content.trim().length > 0) {
    return mdToPlainText(data.content)
  }

  throw new Error("MinerU 返回结果为空")
}

/**
 * Convert Markdown to plain text for resume parsing.
 * Strips headers, bold, links, images, code blocks, etc.
 */
function mdToPlainText(md: string): string {
  return md
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, "")
    // Remove inline code
    .replace(/`([^`]+)`/g, "$1")
    // Remove headers
    .replace(/^#{1,6}\s+/gm, "")
    // Remove bold/italic
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
