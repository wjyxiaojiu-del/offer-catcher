import { NextResponse } from "next/server"
import { getBossInstance, closeBossInstance } from "@/lib/boss-auto"
import { requireApiAccess, requireBossAutomation } from "@/lib/api-guard"
import { apiError } from "@/lib/api-response"
import { parseBody, BossBodySchema } from "@/lib/schemas"
import type { BossJob } from "@/types"

// POST /api/boss - Handle different actions
export async function POST(req: Request) {
  const authError = requireBossAutomation(req)
  if (authError) return authError

  try {
    const parsed = await parseBody(req, BossBodySchema)
    if (!parsed.ok) return apiError(parsed.error, "INVALID_INPUT", 400)
    const { action, config, resumeSkills, resumeId: bodyResumeId } = parsed.data

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
        const boss = await getBossInstance()
        const results = await boss.batchApply(config, resumeSkills || [])

        // Persist successful applications to DB
        const { prisma } = await import("@/lib/db")
        const resumeId = bodyResumeId || undefined
        const sentJobs = results.filter((r: BossJob) => r.status === "sent")
        if (sentJobs.length > 0) {
          try {
            await prisma.$transaction(
              sentJobs.map((job: BossJob) =>
                prisma.application.create({
                  data: {
                    resumeId,
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

        return NextResponse.json({
          results,
          total: results.length,
          sent: results.filter((r: BossJob) => r.status === "sent").length,
          failed: results.filter((r: BossJob) => r.status === "error").length,
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
      apply: "POST { action: 'apply', config: {...}, resumeSkills: [...] } - 批量投递",
      screenshot: "POST { action: 'screenshot' } - 获取浏览器截图",
      close: "POST { action: 'close' } - 关闭浏览器",
    },
  })
}
