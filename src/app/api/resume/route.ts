import { NextResponse } from "next/server"
import { parseResume } from "@/lib/resume-parser"

async function parsePDF(buffer: Buffer): Promise<string> {
  // pdf-parse is a CJS module
  const pdfParse = (await import("pdf-parse" as any)) as any
  const fn = pdfParse.default || pdfParse
  const data = await fn(buffer)
  return data.text
}

async function parseDOCX(buffer: Buffer): Promise<string> {
  const mammoth = (await import("mammoth" as any)) as any
  const fn = mammoth.default || mammoth
  const result = await fn.extractRawText({ buffer })
  return result.value
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || ""

    let text = ""

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      const file = formData.get("file") as File | null

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 })
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const fileName = file.name.toLowerCase()

      if (fileName.endsWith(".pdf")) {
        text = await parsePDF(buffer)
      } else if (fileName.endsWith(".docx")) {
        text = await parseDOCX(buffer)
      } else if (fileName.endsWith(".doc")) {
        try {
          text = await parseDOCX(buffer)
        } catch {
          return NextResponse.json({ error: "不支持 .doc 格式，请转为 .docx 或 .txt" }, { status: 400 })
        }
      } else if (fileName.endsWith(".txt") || fileName.endsWith(".text")) {
        text = buffer.toString("utf-8")
      } else {
        return NextResponse.json({ error: "不支持的文件格式，请上传 PDF/DOCX/TXT 文件" }, { status: 400 })
      }
    } else {
      const body = await req.json()
      text = body.text
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "无法从文件中提取文本内容" }, { status: 400 })
    }

    const resume = parseResume(text)
    return NextResponse.json({ resume })
  } catch (error) {
    console.error("Resume parse error:", error)
    return NextResponse.json({ error: "简历解析失败，请检查文件格式" }, { status: 500 })
  }
}
