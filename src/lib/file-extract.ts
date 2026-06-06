// ============================================================
// Shared resume file extraction (PDF / DOCX / TXT)
// ============================================================
// Single source of truth for turning an uploaded File into text. Both
// /api/resume and /api/agent/parse use this, so size/type checks live in
// one place instead of being copy-pasted (and one copy forgetting them).

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export class FileTooLargeError extends Error {
  constructor(public readonly size: number) {
    super(`文件过大（${(size / 1024 / 1024).toFixed(1)}MB），请上传小于 10MB 的文件`)
    this.name = "FileTooLargeError"
  }
}

export class UnsupportedFileError extends Error {
  constructor() {
    super("不支持的文件格式，请上传 PDF/DOCX/TXT 文件")
    this.name = "UnsupportedFileError"
  }
}

async function parsePDF(buffer: Buffer): Promise<string> {
  const { extractText } = await import("unpdf")
  const uint8 = new Uint8Array(buffer)
  const { text } = await extractText(uint8)
  const joined = Array.isArray(text) ? text.join("\n") : text
  if (joined && joined.trim().length > 5) return joined
  throw new Error("无法从 PDF 中提取文本，建议转为 DOCX/TXT 后上传")
}

async function parseDOCX(buffer: Buffer): Promise<string> {
  try {
    const mammoth = (await import("mammoth" as any)) as any
    const extractRawText = mammoth.extractRawText || mammoth.default?.extractRawText
    if (!extractRawText) throw new Error("mammoth extractRawText not found")
    const result = await extractRawText({ buffer })
    return result.value || ""
  } catch (err: any) {
    console.error("DOCX parse error:", err)
    throw new Error(`DOCX解析失败: ${err.message || "请检查文件格式"}`)
  }
}

/**
 * Extract text from an uploaded resume file.
 * Enforces a 10MB size ceiling and PDF/DOCX/TXT type allow-list.
 *
 * @throws FileTooLargeError when the file exceeds MAX_FILE_SIZE
 * @throws UnsupportedFileError for disallowed extensions
 */
export async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new FileTooLargeError(file.size)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const fileName = file.name.toLowerCase()

  if (fileName.endsWith(".pdf")) {
    return parsePDF(buffer)
  }
  if (fileName.endsWith(".docx")) {
    return parseDOCX(buffer)
  }
  if (fileName.endsWith(".doc")) {
    try {
      return await parseDOCX(buffer)
    } catch {
      throw new Error("不支持 .doc 格式，请转为 .docx 或 .txt")
    }
  }
  if (fileName.endsWith(".txt") || fileName.endsWith(".text")) {
    return buffer.toString("utf-8")
  }
  throw new UnsupportedFileError()
}
