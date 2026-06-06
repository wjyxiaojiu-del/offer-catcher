import { NextResponse } from "next/server"
import { parseResume } from "@/lib/resume-parser"
import { withTimeout, sanitizeText } from "@/lib/utils"
import { apiError } from "@/lib/api-response"
import { requireApiAccess } from "@/lib/api-guard"
import { extractTextFromFile, MAX_FILE_SIZE, FileTooLargeError, UnsupportedFileError } from "@/lib/file-extract"
import { buildResumeWriteData, dbResumeToParsed } from "@/lib/resume-mapper"
import type { ParsedResume } from "@/types"

// ========== AI Parse with timeout ==========
async function aiParseWithTimeout(text: string): Promise<Partial<ParsedResume> | null> {
  try {
    const { aiParseResume } = await import("@/lib/ai")
    const aiResult = await withTimeout(aiParseResume(text), 8000, null, { silent: true })
    if (!aiResult) return null

    return {
      name: aiResult.name,
      email: aiResult.email,
      phone: aiResult.phone,
      education: aiResult.education as any[],
      experience: aiResult.experience as any[],
      skills: aiResult.skills,
      projects: aiResult.projects as any[],
      summary: aiResult.summary,
      source: "ai" as const,
    }
  } catch (err) {
    console.warn("AI parse failed or timed out:", err)
    return null
  }
}

function mergeResumes(rule: ParsedResume, ai: Partial<ParsedResume> | null): ParsedResume {
  if (!ai) return { ...rule, source: "rule" }

  const merged: ParsedResume = {
    name: ai.name && ai.name !== "未知" ? ai.name : rule.name,
    email: ai.email || rule.email,
    phone: ai.phone || rule.phone,
    education: ai.education?.length ? ai.education : rule.education,
    experience: ai.experience?.length ? ai.experience : rule.experience,
    skills: ai.skills?.length
      ? Array.from(new Set([...ai.skills, ...rule.skills]))
      : rule.skills,
    projects: ai.projects?.length
      ? ai.projects.map((p: any, i: number) => ({
          ...p,
          techStack: p.techStack?.length ? p.techStack : rule.projects[i]?.techStack || [],
        }))
      : rule.projects,
    rawText: rule.rawText,
    source: "ai",
    summary: ai.summary || rule.summary,
  }

  return merged
}

// ========== Main handler ==========
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
        return apiError("未提供文件", "MISSING_FILE", 400)
      }
      if (file.size > MAX_FILE_SIZE) {
        return apiError(
          `文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），请上传小于 10MB 的文件`,
          "FILE_TOO_LARGE",
          413
        )
      }
      text = await extractTextFromFile(file)
    } else {
      const body = await req.json().catch(() => ({}))
      text = typeof body?.text === "string" ? body.text : ""
    }

    if (!text || text.trim().length === 0) {
      return apiError("无法从文件中提取文本内容", "EMPTY_TEXT", 400)
    }

    text = sanitizeText(text)

    // Parallel rule-based + AI parsing
    const rulePromise = Promise.resolve(parseResume(text))
    const aiPromise = aiParseWithTimeout(text)

    const [ruleResume, aiPartial] = await Promise.all([rulePromise, aiPromise])
    const resume = mergeResumes({ ...ruleResume, rawText: text }, aiPartial)

    const parseTime = Date.now() - startTime
    console.log(`Resume parsed in ${parseTime}ms (source: ${resume.source})`)

    // Persist to DB (non-blocking, graceful fallback)
    let resumeId: string | undefined
    try {
      const { prisma } = await import("@/lib/db")
      const saved = await prisma.resume.create({
        data: buildResumeWriteData(resume),
      })
      resumeId = saved.id
    } catch (dbErr) {
      console.warn("DB save failed, continuing without persistence:", dbErr)
    }

    return NextResponse.json({ resume, resumeId })
  } catch (error: any) {
    if (error instanceof FileTooLargeError) {
      return apiError(error.message, "FILE_TOO_LARGE", 413)
    }
    if (error instanceof UnsupportedFileError) {
      return apiError(error.message, "UNSUPPORTED_FILE", 415)
    }
    console.error("Resume parse error:", error)
    return apiError(
      "简历解析失败，请检查文件格式",
      "PARSE_ERROR",
      500
    )
  }
}

// ========== GET — fetch resume by id ==========
export async function GET(req: Request) {
  const authError = requireApiAccess(req)
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) {
    return apiError("缺少简历ID", "MISSING_ID", 400)
  }

  try {
    const { prisma } = await import("@/lib/db")
    const dbResume = await prisma.resume.findUnique({
      where: { id },
      include: { educations: true, experiences: true, projects: true, skills: true },
    })
    if (!dbResume) {
      return apiError("简历不存在", "NOT_FOUND", 404)
    }

    const resume: ParsedResume = dbResumeToParsed(dbResume)

    return NextResponse.json({ resume })
  } catch (error: any) {
    console.error("Resume get error:", error)
    return apiError("获取简历失败", "GET_ERROR", 500)
  }
}

// ========== PUT — update resume ==========
export async function PUT(req: Request) {
  const authError = requireApiAccess(req)
  if (authError) return authError

  try {
    const body = await req.json()
    const { id, resume }: { id?: string; resume: ParsedResume } = body
    if (!resume) {
      return apiError("缺少简历数据", "MISSING_DATA", 400)
    }

    const { prisma } = await import("@/lib/db")

    const data = buildResumeWriteData(resume, { forUpdate: true })

    let resultId: string
    if (id) {
      await prisma.resume.update({ where: { id }, data })
      resultId = id
    } else {
      const created = await prisma.resume.create({ data })
      resultId = created.id
    }

    return NextResponse.json({ id: resultId, message: "简历已保存" })
  } catch (error: any) {
    console.error("Resume put error:", error)
    return apiError("保存简历失败", "PUT_ERROR", 500)
  }
}
