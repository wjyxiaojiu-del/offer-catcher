import { chromium, Browser, Page, BrowserContext } from "playwright"
import path from "path"
import fs from "fs"
import type { BossJob, ApplyConfig } from "@/types"

const STATE_DIR = path.join(process.cwd(), ".browser-state")
const STATE_FILE = path.join(STATE_DIR, "boss-session.json")

// CSS selectors — update here when BOSS changes their UI
const SELECTORS = {
  jobCards: ".job-card-wrapper, .job-list-box li, [class*=\"job-card\"]",
  jobTitle: ".job-name, [class*=\"job-name\"], h3",
  companyName: ".company-name, [class*=\"company\"] a, [class*=\"company-name\"]",
  salary: ".salary, [class*=\"salary\"]",
  location: ".job-area, [class*=\"area\"], [class*=\"location\"]",
  tags: ".tag-list li, [class*=\"tag\"] span",
  jobLink: "a[href*=\"/job_detail\"]",
  chatBtn: "button:has-text(\"立即沟通\"), button:has-text(\"沟通\"), [class*=\"btn-start\"], a:has-text(\"立即沟通\")",
  chatInput: "textarea[class*=\"input\"], .chat-input textarea, [class*=\"msg-input\"] textarea, textarea",
  sendBtn: "button:has-text(\"发送\"), [class*=\"btn-send\"], button[class*=\"send\"]",
  qrImg: "img[src*=\"qrcode\"], .qrcode-img img, [class*=\"qr\"] img",
  qrTab: "text=扫码登录",
} as const

// Retry helper with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 2000): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try { return await fn() }
    catch (err) {
      if (attempt === maxRetries) throw err
      await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt - 1)))
    }
  }
  throw new Error("unreachable")
}

export class BossAuto {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null

  // Ensure state directory exists
  private ensureStateDir() {
    if (!fs.existsSync(STATE_DIR)) {
      fs.mkdirSync(STATE_DIR, { recursive: true })
    }
  }

  // Launch browser
  async launch(): Promise<void> {
    // Headless mode: env var override, otherwise headed for QR code
    const headless = process.env.BOSS_HEADLESS === "true"
    const hasSession = fs.existsSync(STATE_FILE)

    // Wrap the full browser→context→page chain so a mid-init failure
    // does not leak a half-launched Chromium process.
    try {
      this.browser = await chromium.launch({
        headless: headless && hasSession, // Only headless if session exists
        args: [
          "--disable-blink-features=AutomationControlled",
          "--no-sandbox",
          "--disable-infobars",
          "--disable-dev-shm-usage",
          "--disable-extensions",
          "--disable-gpu",
          "--no-first-run",
          "--no-default-browser-check",
        ],
      })

      this.ensureStateDir()

      const contextOptions = {
        viewport: { width: 1280, height: 800 },
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale: "zh-CN",
        timezoneId: "Asia/Shanghai",
      }

      // Try to restore session
      if (hasSession) {
        try {
          this.context = await this.browser.newContext({
            ...contextOptions,
            storageState: STATE_FILE,
          })
        } catch {
          this.context = await this.browser.newContext(contextOptions)
        }
      } else {
        this.context = await this.browser.newContext(contextOptions)
      }

      // Stealth: hide automation indicators
      await this.context.addInitScript(() => {
        // Hide webdriver flag
        Object.defineProperty(navigator, "webdriver", { get: () => false })
        // Fake plugins to look like a real browser
        Object.defineProperty(navigator, "plugins", {
          get: () => [1, 2, 3, 4, 5],
        })
        // Fake languages
        Object.defineProperty(navigator, "languages", {
          get: () => ["zh-CN", "zh", "en"],
        })
        // Override permissions query for notifications
        const originalQuery = window.navigator.permissions.query
        window.navigator.permissions.query = (parameters: any) =>
          parameters.name === "notifications"
            ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
            : originalQuery(parameters)
      })

      this.page = await this.context.newPage()
    } catch (err) {
      // Clean up any partially-created resources before rethrowing.
      await this.close().catch(() => {})
      throw err
    }
  }

  // Check if logged in
  async isLoggedIn(): Promise<boolean> {
    if (!this.page) return false
    try {
      await this.page.goto("https://www.zhipin.com/web/boss/info", { waitUntil: "domcontentloaded", timeout: 10000 })
      await this.page.waitForTimeout(2000)
      const url = this.page.url()
      // If redirected to login page, not logged in
      if (url.includes("login") || url.includes("signin")) return false
      return true
    } catch {
      return false
    }
  }

  // Login via QR code - returns QR code image URL
  async getLoginQRCode(): Promise<{ qrUrl: string; pageUrl: string }> {
    if (!this.page) throw new Error("Browser not launched")

    await this.page.goto("https://www.zhipin.com/web/user/?ka=header-login", {
      waitUntil: "domcontentloaded",
    })
    await this.page.waitForTimeout(2000)

    // Find QR code image
    const qrImg = await this.page.$(SELECTORS.qrImg)
    let qrUrl = ""

    if (qrImg) {
      qrUrl = (await qrImg.getAttribute("src")) || ""
    }

    // If no QR found, try to click QR login tab
    if (!qrUrl) {
      const qrTab = await this.page.$(SELECTORS.qrTab)
      if (qrTab) {
        await qrTab.click()
        await this.page.waitForTimeout(1000)
        const qrImg2 = await this.page.$(SELECTORS.qrImg)
        if (qrImg2) qrUrl = (await qrImg2.getAttribute("src")) || ""
      }
    }

    return { qrUrl, pageUrl: this.page.url() }
  }

  // Wait for user to scan QR code and login
  async waitForLogin(timeoutMs = 120000): Promise<boolean> {
    if (!this.page) throw new Error("Browser not launched")

    const startTime = Date.now()
    while (Date.now() - startTime < timeoutMs) {
      const url = this.page.url()
      if (url.includes("boss") && !url.includes("login") && !url.includes("signin")) {
        // Save session state
        await this.context!.storageState({ path: STATE_FILE })
        return true
      }
      await this.page.waitForTimeout(2000)
    }
    return false
  }

  // Search jobs on BOSS
  async searchJobs(config: ApplyConfig): Promise<BossJob[]> {
    if (!this.page) throw new Error("Browser not launched")

    const cityMap: Record<string, string> = {
      "北京": "101010100", "上海": "101020100", "深圳": "101280600",
      "杭州": "101210100", "广州": "101280100", "成都": "101270100",
      "南京": "101190100", "武汉": "101200100", "西安": "101110100",
      "苏州": "101190400", "长沙": "101250100", "重庆": "101040100",
    }

    const cityCode = cityMap[config.city] || "101010100"
    const url = `https://www.zhipin.com/web/geek/job?query=${encodeURIComponent(config.keywords)}&city=${cityCode}`

    await withRetry(async () => {
      await this.page!.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 })
      await this.page!.waitForTimeout(3000)
    })

    const jobs: BossJob[] = []

    // Parse job cards
    const jobCards = await this.page.$$(SELECTORS.jobCards)

    for (const card of jobCards.slice(0, config.maxApply * 2)) {
      try {
        const title = await card.$eval(SELECTORS.jobTitle, el => el.textContent?.trim() || "").catch(() => "")
        const company = await card.$eval(SELECTORS.companyName, el => el.textContent?.trim() || "").catch(() => "")
        const salary = await card.$eval(SELECTORS.salary, el => el.textContent?.trim() || "").catch(() => "")
        const location = await card.$eval(SELECTORS.location, el => el.textContent?.trim() || "").catch(() => "")
        const tags = await card.$$eval(SELECTORS.tags, els => els.map(el => el.textContent?.trim() || "")).catch(() => [])
        const link = await card.$eval(SELECTORS.jobLink, el => (el as HTMLAnchorElement).href).catch(() => "")

        if (title && company) {
          jobs.push({
            title,
            company,
            salary: salary || "面议",
            location: location || config.city,
            experience: tags[0] || "",
            education: tags[1] || "",
            description: "",
            url: link || "",
            hrName: "",
            status: "pending",
          })
        }
      } catch {
        continue
      }
    }

    // Filter by salary if specified
    if (config.minSalary) {
      return jobs.filter(job => {
        const match = job.salary.match(/(\d+)/)
        return match ? parseInt(match[1]) >= config.minSalary! : true
      })
    }

    return jobs
  }

  // Send greeting to a specific job
  async sendGreeting(job: BossJob, greeting: string): Promise<{ success: boolean; message: string }> {
    if (!this.page) throw new Error("Browser not launched")

    try {
      // Navigate to job detail page
      if (job.url) {
        await withRetry(async () => {
          await this.page!.goto(job.url, { waitUntil: "domcontentloaded", timeout: 30000 })
          await this.page!.waitForTimeout(2000)
        })
      }

      // Find and click "立即沟通" button
      const chatBtn = await this.page.$(SELECTORS.chatBtn)
      if (!chatBtn) {
        return { success: false, message: "未找到沟通按钮" }
      }

      await chatBtn.click()
      await this.page.waitForTimeout(2000)

      // Find greeting input and send
      const chatInput = await this.page.$(SELECTORS.chatInput)
      if (chatInput) {
        await chatInput.fill(greeting)
        await this.page.waitForTimeout(500)

        // Click send button
        const sendBtn = await this.page.$(SELECTORS.sendBtn)
        if (sendBtn) {
          await sendBtn.click()
          await this.page.waitForTimeout(1000)
          return { success: true, message: "已发送打招呼" }
        }
      }

      return { success: false, message: "未找到输入框或发送按钮" }
    } catch (err: any) {
      return { success: false, message: err.message || "发送失败" }
    }
  }

  // Generate AI greeting
  async generateGreeting(job: BossJob, resumeSkills: string[]): Promise<string> {
    try {
      const OpenAI = (await import("openai")).default
      const client = new OpenAI({
        apiKey: process.env.MIMO_API_KEY,
        baseURL: process.env.MIMO_BASE_URL,
      })

      const res = await client.chat.completions.create({
        model: process.env.MIMO_MODEL || "mimo-v2.5-pro",
        messages: [
          {
            role: "system",
            content: "你是一个求职助手。根据岗位信息和候选人技能，生成一句简短专业的打招呼语（50字以内）。语气自然友好，突出匹配点。"
          },
          {
            role: "user",
            content: `岗位: ${job.title} @ ${job.company}\n薪资: ${job.salary}\n要求: ${job.experience} ${job.education}\n候选人技能: ${resumeSkills.join(", ")}\n\n请生成一句打招呼语。`
          }
        ],
        temperature: 0.7,
        max_tokens: 100,
      })

      return res.choices[0]?.message?.content || `您好，我对${job.title}岗位很感兴趣，希望有机会沟通。`
    } catch {
      return `您好，我对${job.title}岗位很感兴趣，我的背景与岗位需求比较匹配，希望有机会进一步沟通。`
    }
  }

  // Batch apply to jobs
  async batchApply(
    config: ApplyConfig,
    resumeSkills: string[],
    onProgress?: (job: BossJob, result: { success: boolean; message: string }) => void
  ): Promise<BossJob[]> {
    const jobs = await this.searchJobs(config)
    const toApply = jobs.slice(0, config.maxApply)
    const results: BossJob[] = []

    for (const job of toApply) {
      // Generate personalized greeting
      const greeting = config.greeting || await this.generateGreeting(job, resumeSkills)

      // Send greeting
      const result = await this.sendGreeting(job, greeting)

      job.status = result.success ? "sent" : "error"
      job.message = result.message
      results.push(job)

      onProgress?.(job, result)

      // Random delay to avoid detection
      const delay = 3000 + Math.random() * 5000
      await this.page?.waitForTimeout(delay)
    }

    // Save session state
    if (this.context) {
      await this.context.storageState({ path: STATE_FILE })
    }

    return results
  }

  // Close browser
  async close(): Promise<void> {
    if (this.context) {
      this.ensureStateDir()
      await this.context.storageState({ path: STATE_FILE }).catch(() => {})
    }
    if (this.browser) {
      await this.browser.close()
    }
    this.browser = null
    this.context = null
    this.page = null
  }

  // Lightweight liveness check — throws if the browser/page is gone.
  // Cheaper than screenshot() and never hangs on a stuck page.
  assertAlive(): void {
    if (!this.browser || !this.browser.isConnected() || !this.page || this.page.isClosed()) {
      throw new Error("Browser instance is not alive")
    }
  }

  // Get screenshot for frontend display
  async screenshot(): Promise<string> {
    if (!this.page) return ""
    const buffer = await this.page.screenshot({ type: "jpeg", quality: 60 })
    return `data:image/jpeg;base64,${buffer.toString("base64")}`
  }
}

// Singleton instance management
let instance: BossAuto | null = null
// Mutex: in-flight launch so concurrent callers reuse one Chromium
// instead of each spawning (and leaking) their own.
let launchPromise: Promise<BossAuto> | null = null

export async function getBossInstance(): Promise<BossAuto> {
  // Reuse a healthy existing instance. Liveness check uses a cheap
  // page.url() rather than a screenshot (which is heavy and can hang).
  if (instance) {
    try {
      instance.assertAlive()
      return instance
    } catch {
      await instance.close().catch(() => {})
      instance = null
    }
  }

  // If a launch is already underway, await it instead of starting another.
  if (launchPromise) return launchPromise

  launchPromise = (async () => {
    const candidate = new BossAuto()
    await candidate.launch()
    instance = candidate
    return candidate
  })()

  try {
    return await launchPromise
  } catch (err) {
    instance = null
    throw err
  } finally {
    launchPromise = null
  }
}

export async function closeBossInstance(): Promise<void> {
  if (instance) {
    await instance.close()
    instance = null
  }
}
