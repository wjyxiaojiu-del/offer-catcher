import { CareerAgent } from "@/lib/agent/career-agent"
import { withTimeout } from "@/lib/utils"
import { requireApiAccess } from "@/lib/api-guard"
import { AgentChatBodySchema } from "@/lib/schemas"
import { getDeviceIdFromRequest } from "@/lib/api-device"
import { prisma } from "@/lib/db"
import { dbResumeToParsed } from "@/lib/resume-mapper"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const authError = requireApiAccess(req, { rateLimitKind: "ai" })
  if (authError) return authError

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ message: "请求格式错误" })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream; charset=utf-8" } }
    )
  }

  const parsed = AgentChatBodySchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || "参数校验失败"
    return new Response(
      `event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream; charset=utf-8" } }
    )
  }

  const { message, resumeText, userId } = parsed.data
  const deviceId = getDeviceIdFromRequest(req)
  const effectiveUserId = userId || deviceId
  const sessionId = parsed.data.sessionId || crypto.randomUUID()

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          // stream already closed
        }
      }

      try {
        const agent = new CareerAgent({ sessionId, userId: effectiveUserId })
        await agent.init()

        // 1. Load resume by ID (fastest — already parsed in DB)
        const resumeId = parsed.data.resumeId
        if (resumeId) {
          try {
            const dbResume = await prisma.resume.findFirst({
              where: { id: resumeId, deviceId: deviceId || undefined },
              include: { educations: true, experiences: true, projects: true, skills: true },
            })
            if (dbResume) {
              const parsedResume = dbResumeToParsed(dbResume)
              agent.setResume(parsedResume)
              send("thinking", { step: 1, text: `📄 已加载简历：${parsedResume.name}` })
              send("task", { taskId: "parse", status: "completed", agent: "parseResumeText" })
            }
          } catch (err) {
            console.warn("Load resume by ID failed:", err)
          }
        }

        // 2. Fallback: parse raw text if no DB resume
        if (!agent.getResume() && resumeText && resumeText.trim().length > 0) {
          send("thinking", { step: 1, text: "📄 正在解析简历..." })
          await withTimeout(agent.parseResume(resumeText), 30000, null)
          send("task", { taskId: "parse", status: "completed", agent: "parseResumeText" })
        }

        send("thinking", { step: 2, text: "🧠 正在理解您的意图..." })
        send("thinking", { step: 3, text: "📋 正在规划任务..." })

        const response = await withTimeout(agent.chat(message.trim()), 30000, null)

        if (!response) {
          send("error", { message: "Agent 响应超时，请稍后重试" })
          controller.close()
          return
        }

        // Stream actual thinking steps from orchestrator
        if (response.thinking && response.thinking.length > 0) {
          for (let i = 0; i < response.thinking.length; i++) {
            send("thinking", { step: 4 + i, text: response.thinking[i] })
          }
        }

        // Stream task updates
        for (const task of response.tasks) {
          send("task", {
            taskId: task.id,
            status: task.status,
            agent: task.agent,
            name: task.name,
          })
        }

        // Extract match results if available
        let matches = undefined
        const matchTask = response.tasks.find((t) => t.id === "match" && t.status === "completed")
        if (matchTask?.result) {
          matches = matchTask.result
        }

        send("result", {
          content: response.content,
          tasks: response.tasks,
          toolCalls: response.toolCalls,
          matches,
          sessionId,
        })
      } catch (err: any) {
        console.error("Agent chat error:", err)
        send("error", { message: err.message || "服务出错了，请稍后重试" })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
