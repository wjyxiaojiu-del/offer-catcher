import { NextResponse } from "next/server"
import { multiAgentParseResume } from "@/lib/agent/resume-agents"
import { withTimeout, sanitizeText } from "@/lib/utils"
import { requireApiAccess } from "@/lib/api-guard"
import type { ParsedResume } from "@/types"
import type { AgentRunResult } from "@/lib/agent/resume-agents"

// ========== PDF Parser (unpdf) ==========
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

async function extractTextFromFile(file: File): Promise<string> {
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
  throw new Error("不支持的文件格式，请上传 PDF/DOCX/TXT 文件")
}

interface ParseResponse {
  resume: ParsedResume
  agents: { agentName: string; status: string; durationMs: number }[]
  source: "multi-agent"
  resumeId?: string
}

/**
 * POST /api/agent/parse
 *
 * Parses a resume using the multi-agent collaborative pipeline.
 * Accepts either JSON body `{ text: string }` or multipart form-data with a file.
 *
 * Response:
 * {
 *   resume: ParsedResume,
 *   agents: [{ agentName, status, durationMs }],
 *   source: "multi-agent",
 *   resumeId?: string
 * }
 */
export async function POST(req: Request) {
  const authError = requireApiAccess(req, { rateLimitKind: "ai" })
  if (authError) return authError

  const startTime = Date.now()
  try {
    const contentType = req.headers.get("content-type") || ""
    let text = ""

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      const file = formData.get("file") as File | null
      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 })
      }
      text = await extractTextFromFile(file)
    } else {
      const body = await req.json()
      text = body.text
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "无法从文件中提取文本内容" }, { status: 400 })
    }

    text = sanitizeText(text)

    // Run multi-agent pipeline with 15s timeout
    const parseResult = await withTimeout(
      multiAgentParseResume(text),
      15000,
      null
    )

    if (!parseResult) {
      return NextResponse.json({ error: "多Agent解析超时，请重试" }, { status: 504 })
    }

    const { resume, agents, source } = parseResult

    const parseTime = Date.now() - startTime
    console.log(`Multi-agent resume parsed in ${parseTime}ms, agents: ${agents.length}`)

    // Persist to DB (non-blocking, graceful fallback)
    let resumeId: string | undefined
    try {
      const { prisma } = await import("@/lib/db")
      const saved = await prisma.resume.create({
        data: {
          name: resume.name,
          email: resume.email,
          phone: resume.phone,
          rawText: resume.rawText,
          source: resume.source || "rule",
          summary: resume.summary || "",
          educations: {
            create: resume.education.map((e) => ({
              school: e.school || "",
              major: e.major || "",
              degree: e.degree || "",
              year: e.year || "",
              startYear: e.startYear,
              endYear: e.endYear,
              gpa: e.gpa,
            })),
          },
          experiences: {
            create: resume.experience.map((e) => ({
              company: e.company || "",
              title: e.title || "",
              duration: e.duration || "",
              description: e.description || "",
              startDate: e.startDate,
              endDate: e.endDate,
            })),
          },
          projects: {
            create: resume.projects.map((p) => ({
              name: p.name || "",
              description: p.description || "",
              techStack: JSON.stringify(p.techStack || []),
            })),
          },
          skills: {
            create: resume.skills.map((s) => ({ name: s })),
          },
        },
      })
      resumeId = saved.id
    } catch (dbErr) {
      console.warn("DB save failed, continuing without persistence:", dbErr)
    }

    return NextResponse.json({
      resume,
      agents: agents.map((a: AgentRunResult<unknown>) => ({
        agentName: a.agentName,
        status: a.status,
        durationMs: a.durationMs,
      })),
      source,
      resumeId,
    })
  } catch (error: any) {
    console.error("Multi-agent resume parse error:", error)
    return NextResponse.json(
      { error: `简历解析失败: ${error.message || "请检查文件格式"}` },
      { status: 500 }
    )
  }
}
