import { NextResponse } from "next/server"
import { multiAgentParseResume } from "@/lib/agent/resume-agents"
import { withTimeout, sanitizeText } from "@/lib/utils"
import { requireApiAccess } from "@/lib/api-guard"
import { extractTextFromFile, FileTooLargeError, UnsupportedFileError } from "@/lib/file-extract"
import { buildResumeWriteData } from "@/lib/resume-mapper"
import { getDeviceIdFromRequest } from "@/lib/api-device"
import type { ParsedResume } from "@/types"
import type { AgentRunResult } from "@/lib/agent/resume-agents"

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
      const deviceId = getDeviceIdFromRequest(req)
      const saved = await prisma.resume.create({
        data: { ...buildResumeWriteData(resume), deviceId: deviceId || undefined },
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
    if (error instanceof FileTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 })
    }
    if (error instanceof UnsupportedFileError) {
      return NextResponse.json({ error: error.message }, { status: 415 })
    }
    console.error("Multi-agent resume parse error:", error)
    return NextResponse.json(
      { error: "简历解析失败，请检查文件格式" },
      { status: 500 }
    )
  }
}
