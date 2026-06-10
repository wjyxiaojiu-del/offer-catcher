import { NextResponse } from "next/server"
import { getBossInstance, closeBossInstance } from "@/lib/boss-auto"
import { requireApiAccess, requireBossAutomation } from "@/lib/api-guard"
import { apiError } from "@/lib/api-response"
import { parseBody, BossBodySchema } from "@/lib/schemas"
import { getDeviceIdFromRequest } from "@/lib/api-device"
import type { BossJob } from "@/types"

// ── In-memory task store for async apply ──────────────────────────────────
// BOSS automation only runs in local/Docker (not Vercel serverless), so
// in-memory state is safe. Tasks expire after 30 min to prevent leaks.

type TaskState = {
  status: "running" | "done" | "error"
  results: BossJob[]
  currentJob?: string
  progress: { current: number; total: number }
  error?: string
  createdAt: number
}

const tasks = new Map<string, TaskState>()

function generateTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function cleanupExpiredTasks(maxAgeMs = 30 * 60 * 1000) {
  const cutoff = Date.now() - maxAgeMs
  tasks.forEach((task, id) => {
    if (task.createdAt < cutoff) tasks.delete(id)
  })
}

// POST /api/boss - Handle different actions
export async function POST(req: Request) {
  const authError = requireBossAutomation(req)
  if (authError) return authError

  try {
    const parsed = await parseBody(req, BossBodySchema)
    if (!parsed.ok) return apiError(parsed.error, "INVALID_INPUT", 400)
    const { action, config, resumeSkills, resumeId: bodyResumeId, taskId } = parsed.data
    const deviceId = getDeviceIdFromRequest(req)

    switch (action) {
      case "launch": {
        const boss = await getBossInstance()
        const loggedIn = await boss.isLoggedIn()
        if (loggedIn) {
          return NextResponse.json({ status: "logged_in", message: "已登录 BOSS 直聘" })
        }
        const qr = await boss.getLoginQRCode()
        return NextResponse.json({ status: "need_login", qr, message: "请用 BOSS 直聘 App 扫码登录" })
      }

      case "login-status": {
        const boss = await getBossInstance()
        const loggedIn = await boss.isLoggedIn()
        return NextResponse.json({ loggedIn })
      }

      case "wait-login": {
        const boss = await getBossInstance()
        const success = await boss.waitForLogin(120000)
        return NextResponse.json({ success, message: success ? "登录成功" : "登录超时" })
      }

      case "search": {
        const boss = await getBossInstance()
        const jobs = await boss.searchJobs(config)
        return NextResponse.json({ jobs, total: jobs.length })
      }

      case "apply": {
        const newTaskId = generateTaskId()
        tasks.set(newTaskId, {
          status: "running",
          results: [],
          progress: { current: 0, total: 0 },
          createdAt: Date.now(),
        })

        // Run async so the HTTP response returns immediately
        ;(async () => {
          try {
            const boss = await getBossInstance()
            const selectedJobs: BossJob[] = config?.selectedJobs ?? []
            const toApplyCount = selectedJobs.length || (config?.maxApply ?? 10)

            tasks.set(newTaskId, {
              status: "running",
              results: [],
              progress: { current: 0, total: toApplyCount },
              createdAt: Date.now(),
            })

            const results = await boss.batchApply(
              config,
              resumeSkills || [],
              (job, result) => {
                const existing = tasks.get(newTaskId)
                if (!existing) return
                existing.results.push({ ...job, status: result.success ? "sent" : "error", message: result.message })
                existing.currentJob = job.title
                existing.progress.current = existing.results.length
                tasks.set(newTaskId, existing)
              }
            )

            // Persist successful applications to DB
            const resumeId = bodyResumeId || undefined
            const sentJobs = results.filter((r: BossJob) => r.status === "sent")
            if (sentJobs.length > 0) {
              try {
                const { prisma } = await import("@/lib/db")
                await prisma.$transaction(
                  sentJobs.map((job: BossJob) =>
                    prisma.application.create({
                      data: {
                        resumeId,
                        deviceId: deviceId || undefined,
                        jobSnapshot: JSON.stringify({
                          title: job.title,
                          company: job.company,
                          location: job.location,
                          salary: job.salary,
                          experience: job.experience,
                          education: job.education,
                          description: job.description,
                          url: job.url,
                          hrName: job.hrName,
                        }),
                        status: "applied",
                        method: "boss_auto",
                        notes: job.message || "BOSS 直聘自动投递",
                      },
                    })
                  )
                )
              } catch (dbErr) {
                console.warn("BOSS apply DB persist failed:", dbErr)
              }
            }

            tasks.set(newTaskId, {
              status: "done",
              results,
              progress: { current: results.length, total: toApplyCount },
              createdAt: Date.now(),
            })
          } catch (err: any) {
            const existing = tasks.get(newTaskId)
            tasks.set(newTaskId, {
              status: "error",
              results: existing?.results ?? [],
              progress: existing?.progress ?? { current: 0, total: 0 },
              error: err.message || "投递失败",
              createdAt: Date.now(),
            })
          }
        })()

        return NextResponse.json({ taskId: newTaskId, message: "投递任务已启动" })
      }

      case "progress": {
        if (!taskId) return apiError("缺少 taskId", "MISSING_TASK_ID", 400)
        cleanupExpiredTasks()
        const task = tasks.get(taskId)
        if (!task) return NextResponse.json({ status: "not_found" }, { status: 404 })

        return NextResponse.json({
          status: task.status,
          progress: task.progress,
          currentJob: task.currentJob,
          results: task.status === "done" ? task.results : undefined,
          error: task.error,
        })
      }

      case "screenshot": {
        const boss = await getBossInstance()
        const img = await boss.screenshot()
        return NextResponse.json({ screenshot: img })
      }

      case "close": {
        await closeBossInstance()
        return NextResponse.json({ success: true, message: "浏览器已关闭" })
      }

      default:
        return NextResponse.json({ error: "未知操作" }, { status: 400 })
    }
  } catch (error: any) {
    console.error("Boss API error:", error)
    return NextResponse.json({ error: "操作失败" }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const authError = requireApiAccess(req)
  if (authError) return authError

  return NextResponse.json({
    service: "BOSS 直聘自动投递",
    status: process.env.BOSS_AUTOMATION_ENABLED === "true" ? "enabled" : "disabled",
    endpoints: {
      launch: "POST { action: 'launch' } - 启动浏览器，获取登录二维码",
      "login-status": "POST { action: 'login-status' } - 检查登录状态",
      "wait-login": "POST { action: 'wait-login' } - 等待扫码登录",
      search: "POST { action: 'search', config: { keywords, city, maxApply } } - 搜索岗位",
      apply: "POST { action: 'apply', config: {...}, resumeSkills: [...] } - 启动异步投递任务",
      progress: "POST { action: 'progress', taskId } - 查询投递进度",
      screenshot: "POST { action: 'screenshot' } - 获取浏览器截图",
      close: "POST { action: 'close' } - 关闭浏览器",
    },
  })
}
