"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  CheckSquare, Square, Rocket, Eye, Timer, Shield,
  ChevronDown, ChevronUp, MapPin, Building2, Banknote,
} from "lucide-react"
import type { BossJob } from "@/types"

type Step = "init" | "login" | "config" | "searching" | "results" | "applying" | "done"

function calcMatchScore(resume: any, job: BossJob): number {
  const jobText = `${job.title} ${job.experience} ${job.education}`.toLowerCase()
  const skills: string[] = resume?.skills || []
  if (skills.length === 0) return 50
  let matched = 0
  skills.forEach((skill: string) => {
    const s = skill.toLowerCase()
    if (jobText.includes(s) || s.split(/[\/\s+#]/).some(part => part.length > 1 && jobText.includes(part))) {
      matched++
    }
  })
  return Math.min(100, Math.round((matched / skills.length) * 100))
}

function scoreBadge(score: number) {
  if (score >= 80) return { label: "高度匹配", className: "bg-green-100 text-green-700" }
  if (score >= 60) return { label: "较好匹配", className: "bg-blue-100 text-blue-700" }
  if (score >= 40) return { label: "一般匹配", className: "bg-yellow-100 text-yellow-700" }
  return { label: "匹配度低", className: "bg-gray-100 text-gray-600" }
}

function BossPage() {
  const [step, setStep] = useState<Step>("init")
  const [resume, setResume] = useState<any>(null)
  const [screenshot, setScreenshot] = useState("")
  const [loginMessage, setLoginMessage] = useState("")
  const [jobs, setJobs] = useState<BossJob[]>([])
  const [results, setResults] = useState<BossJob[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Config
  const [keywords, setKeywords] = useState("前端开发")
  const [city, setCity] = useState("北京")
  const [maxApply, setMaxApply] = useState(5)
  const [greeting, setGreeting] = useState("")
  const [minSalary, setMinSalary] = useState(0)
  const [applyDelayMin, setApplyDelayMin] = useState(15)
  const [applyDelayMax, setApplyDelayMax] = useState(25)

  // Selection
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [showAllJobs, setShowAllJobs] = useState(false)

  // Async apply progress
  const [taskId, setTaskId] = useState<string | null>(null)
  const [applyProgress, setApplyProgress] = useState<{ current: number; total: number; currentJob: string } | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const screenshotPollRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const resumeId = searchParams.get("resumeId")
    if (!resumeId) { router.push("/"); return }

    fetch(`/api/resume?id=${resumeId}`)
      .then(r => r.json())
      .then(data => {
        if (!data.resume) { router.push("/"); return }
        setResume(data.resume)
        if (data.resume?.skills?.length > 0) {
          setKeywords(data.resume.skills.slice(0, 3).join(" "))
        }
      })
      .catch(() => {})
  }, [router, searchParams])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (screenshotPollRef.current) clearInterval(screenshotPollRef.current)
    }
  }, [])

  const apiCall = async (body: any) => {
    const res = await fetch("/api/boss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : data.error?.message || `请求失败 (${res.status})`)
    }
    return data
  }

  const handleLaunch = async () => {
    setLoading(true)
    setError("")
    try {
      const data = await apiCall({ action: "launch" })
      if (data.status === "logged_in") {
        setLoginMessage(data.message)
        setStep("config")
      } else if (data.status === "need_login") {
        setStep("login")
        setLoginMessage("请用 BOSS 直聘 App 扫描下方二维码登录")
        pollRef.current = setInterval(async () => {
          const status = await apiCall({ action: "login-status" })
          if (status.loggedIn) {
            if (pollRef.current) clearInterval(pollRef.current)
            setLoginMessage("登录成功！")
            setTimeout(() => setStep("config"), 1000)
          }
        }, 3000)
      }
    } catch (err: any) {
      setError(err.message || "启动失败")
    }
    setLoading(false)
  }

  const handleSearch = async () => {
    setStep("searching")
    setLoading(true)
    setError("")
    setSelectedIndices(new Set())
    try {
      const data = await apiCall({
        action: "search",
        config: { keywords, city, maxApply, minSalary: minSalary || undefined },
      })
      const found: BossJob[] = data.jobs || []
      setJobs(found)
      // Auto-select top matches up to maxApply
      const topIndices = new Set<number>()
      found
        .map((job, i) => ({ i, score: calcMatchScore(resume, job) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, maxApply)
        .forEach(item => topIndices.add(item.i))
      setSelectedIndices(topIndices)
      setStep("results")
    } catch (err: any) {
      setError(err.message || "搜索失败")
      setStep("config")
    }
    setLoading(false)
  }

  const handleApply = async () => {
    if (selectedIndices.size === 0) return
    setStep("applying")
    setLoading(true)
    setError("")
    setScreenshot("")

    const selectedJobs = Array.from(selectedIndices)
      .sort((a, b) => a - b)
      .map(i => jobs[i])
      .filter(Boolean)

    try {
      const resumeId = searchParams.get("resumeId")
      const data = await apiCall({
        action: "apply",
        config: {
          keywords,
          city,
          maxApply: selectedJobs.length,
          greeting: greeting || undefined,
          minSalary: minSalary || undefined,
          selectedJobs,
          delayMin: applyDelayMin * 1000,
          delayMax: applyDelayMax * 1000,
        },
        resumeSkills: resume?.skills || [],
        resumeId,
      })

      if (data.taskId) {
        setTaskId(data.taskId)
        setApplyProgress({ current: 0, total: selectedJobs.length, currentJob: "准备中..." })

        // Poll progress
        pollRef.current = setInterval(async () => {
          const progressData = await apiCall({ action: "progress", taskId: data.taskId })
          if (progressData.status === "running") {
            setApplyProgress({
              current: progressData.progress?.current ?? 0,
              total: progressData.progress?.total ?? selectedJobs.length,
              currentJob: progressData.currentJob || "投递中...",
            })
          } else if (progressData.status === "done") {
            if (pollRef.current) clearInterval(pollRef.current)
            setResults(progressData.results || [])
            setApplyProgress(null)
            setStep("done")
            setLoading(false)
          } else if (progressData.status === "error") {
            if (pollRef.current) clearInterval(pollRef.current)
            setError(progressData.error || "投递失败")
            setApplyProgress(null)
            setStep("results")
            setLoading(false)
          }
        }, 3000)

        // Poll screenshot in parallel
        screenshotPollRef.current = setInterval(async () => {
          try {
            const ss = await apiCall({ action: "screenshot" })
            if (ss.screenshot) setScreenshot(ss.screenshot)
          } catch { /* ignore */ }
        }, 4000)
      } else {
        throw new Error("未返回任务 ID")
      }
    } catch (err: any) {
      setError(err.message || "投递失败")
      setStep("results")
      setLoading(false)
    }
  }

  const handleClose = async () => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (screenshotPollRef.current) clearInterval(screenshotPollRef.current)
    await apiCall({ action: "close" })
    setStep("init")
    setJobs([])
    setResults([])
    setTaskId(null)
    setApplyProgress(null)
    setScreenshot("")
  }

  const toggleJob = (index: number) => {
    const next = new Set(selectedIndices)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setSelectedIndices(next)
  }

  const toggleAll = () => {
    if (selectedIndices.size === jobs.length) {
      setSelectedIndices(new Set())
    } else {
      setSelectedIndices(new Set(jobs.map((_, i) => i)))
    }
  }

  const cities = ["北京", "上海", "深圳", "杭州", "广州", "成都", "南京", "武汉", "西安", "苏州", "长沙", "重庆"]
  const displayJobs = showAllJobs ? jobs : jobs.slice(0, 20)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 animate-slide-up">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold">🤖 BOSS 直聘辅助投递</h1>
        <p className="text-gray-500 mt-2">AI 筛选岗位 + 人工确认 + 低频率自动打招呼</p>
      </div>

      {/* Resume Info */}
      {resume && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-800">
            <span className="font-medium">当前简历:</span> {resume.name} · 技能: {resume.skills?.slice(0, 5).join(", ")}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-700">❌ {error}</p>
        </div>
      )}

      {/* Step: Init */}
      {step === "init" && (
        <div className="bg-white rounded-xl border p-6 text-center">
          <div className="text-5xl mb-4">🚀</div>
          <h2 className="text-xl font-bold mb-2">启动辅助投递</h2>
          <p className="text-gray-500 mb-6">将打开浏览器窗口，需要你用 BOSS 直聘 App 扫码登录</p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left space-y-2">
            <p className="text-sm text-yellow-800 font-medium">⚠️ 安全使用须知</p>
            <ul className="text-xs text-yellow-700 space-y-1">
              <li>• <b>辅助工具，非全自动机器人</b>：需要你勾选确认后再投递</li>
              <li>• <b>低频率策略</b>：每次操作间隔 15-25 秒，模拟真实人工操作</li>
              <li>• <b>行为模拟</b>：自动滚动页面、鼠标缓动移动，降低被检测概率</li>
              <li>• <b>建议单次投递 ≤5 个</b>，每小时不超过 10 个，避免触发风控</li>
              <li>• 登录状态会自动保存，下次无需重新扫码</li>
            </ul>
          </div>
          <button onClick={handleLaunch} disabled={loading}
            className="px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50">
            {loading ? "启动中..." : "🟢 启动浏览器"}
          </button>
        </div>
      )}

      {/* Step: Login */}
      {step === "login" && (
        <div className="bg-white rounded-xl border p-6 text-center">
          <div className="text-4xl mb-4">📱</div>
          <h2 className="text-xl font-bold mb-2">{loginMessage}</h2>
          <p className="text-gray-500 mb-4">浏览器窗口已打开，请切换到浏览器完成扫码</p>
          <div className="animate-pulse text-sm text-blue-600 mb-4">等待扫码中...</div>
          <button onClick={async () => {
            const data = await apiCall({ action: "login-status" })
            if (data.loggedIn) {
              setLoginMessage("登录成功！")
              setTimeout(() => setStep("config"), 1000)
            }
          }} className="text-sm text-blue-600 hover:underline">
            我已扫码，刷新状态
          </button>
        </div>
      )}

      {/* Step: Config */}
      {step === "config" && (
        <div className="space-y-6 animate-slide-up">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm text-green-800">✅ {loginMessage || "已登录 BOSS 直聘"}</p>
          </div>

          <div className="bg-white rounded-xl border p-5 space-y-5">
            <h2 className="font-bold text-lg">📋 投递配置</h2>

            <div>
              <label className="block text-sm font-medium mb-1">🔍 搜索关键词</label>
              <input value={keywords} onChange={e => setKeywords(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="如：前端开发 React" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">📍 城市</label>
              <div className="flex flex-wrap gap-2">
                {cities.map(c => (
                  <button key={c} onClick={() => setCity(c)}
                    className={`px-3 py-1.5 rounded-lg text-sm ${city === c ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">📮 单次最多投递</label>
                <input type="number" value={maxApply} onChange={e => setMaxApply(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                  min={1} max={10}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 mt-1">建议 ≤5，防止触发风控</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">💰 最低薪资 (K)</label>
                <input type="number" value={minSalary} onChange={e => setMinSalary(parseInt(e.target.value) || 0)}
                  min={0} placeholder="0 = 不限"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Timer className="w-4 h-4" />
                <span>投递间隔（防检测）</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-500">最小 {applyDelayMin}s</label>
                  <input type="range" min={10} max={30} value={applyDelayMin}
                    onChange={e => {
                      const v = parseInt(e.target.value)
                      setApplyDelayMin(v)
                      if (v > applyDelayMax) setApplyDelayMax(v)
                    }}
                    className="w-full" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500">最大 {applyDelayMax}s</label>
                  <input type="range" min={10} max={60} value={applyDelayMax}
                    onChange={e => {
                      const v = parseInt(e.target.value)
                      setApplyDelayMax(v)
                      if (v < applyDelayMin) setApplyDelayMin(v)
                    }}
                    className="w-full" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">💬 打招呼语（留空则 AI 自动生成）</label>
              <textarea value={greeting} onChange={e => setGreeting(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm h-20 resize-none focus:ring-2 focus:ring-blue-500"
                placeholder="留空则根据岗位自动生成个性化招呼语" />
            </div>
          </div>

          <button onClick={handleSearch} disabled={loading || !keywords.trim()}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50">
            🔍 搜索岗位
          </button>
        </div>
      )}

      {/* Step: Searching */}
      {step === "searching" && (
        <div className="bg-white rounded-xl border p-8 text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-lg font-medium">正在搜索岗位...</p>
          <p className="text-sm text-gray-500 mt-1">关键词: {keywords} · 城市: {city}</p>
        </div>
      )}

      {/* Step: Results */}
      {step === "results" && (
        <div className="space-y-4 animate-slide-up">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-bold">📋 搜索结果 ({jobs.length} 个岗位)</h2>
            <div className="flex gap-2">
              <button onClick={() => setStep("config")} className="text-sm text-gray-500 hover:text-gray-700">返回修改</button>
            </div>
          </div>

          {/* Selection bar */}
          <div className="flex items-center justify-between bg-white rounded-xl border p-3">
            <button onClick={toggleAll} className="flex items-center gap-2 text-sm font-medium hover:text-blue-600">
              {selectedIndices.size === jobs.length && jobs.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              已选择 {selectedIndices.size} / {jobs.length} 个
            </button>
            <button onClick={handleApply} disabled={selectedIndices.size === 0 || loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5">
              <Rocket className="w-4 h-4" />
              批量投递 ({selectedIndices.size})
            </button>
          </div>

          <div className="space-y-3">
            {displayJobs.map((job, i) => {
              const score = calcMatchScore(resume, job)
              const badge = scoreBadge(score)
              const checked = selectedIndices.has(i)
              return (
                <div key={i} onClick={() => toggleJob(i)}
                  className={`bg-white rounded-xl border p-4 flex items-start gap-3 cursor-pointer hover:shadow-sm transition-shadow ${checked ? "border-blue-300 ring-1 ring-blue-200" : ""}`}>
                  <div className="pt-0.5" onClick={e => { e.stopPropagation(); toggleJob(i) }}>
                    {checked ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold">{job.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${badge.className}`}>{badge.label} · {score}分</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{job.company}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>
                      <span className="flex items-center gap-1"><Banknote className="w-3.5 h-3.5" />{job.salary}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{job.experience} · {job.education}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {jobs.length > 20 && !showAllJobs && (
            <button onClick={() => setShowAllJobs(true)}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1">
              展开全部 {jobs.length} 个岗位 <ChevronDown className="w-4 h-4" />
            </button>
          )}
          {showAllJobs && jobs.length > 20 && (
            <button onClick={() => setShowAllJobs(false)}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1">
              收起 <ChevronUp className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Step: Applying */}
      {step === "applying" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-6 text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-green-200 rounded-full" />
              <div className="absolute inset-0 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-lg font-medium">正在批量投递...</p>
            <p className="text-sm text-gray-500 mt-1">每单间隔 {applyDelayMin}-{applyDelayMax} 秒，模拟真实人工操作</p>

            {applyProgress && (
              <div className="mt-4 max-w-md mx-auto">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">进度</span>
                  <span className="font-medium">{applyProgress.current} / {applyProgress.total}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${applyProgress.total > 0 ? (applyProgress.current / applyProgress.total) * 100 : 0}%` }} />
                </div>
                {applyProgress.currentJob && (
                  <p className="text-xs text-gray-500 mt-2 truncate">当前: {applyProgress.currentJob}</p>
                )}
              </div>
            )}
          </div>

          {/* Live screenshot */}
          {screenshot && (
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">实时浏览器画面</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={screenshot} alt="浏览器截图" className="w-full rounded-lg border" />
            </div>
          )}
        </div>
      )}

      {/* Step: Done */}
      {step === "done" && (
        <div className="space-y-6 animate-slide-up">
          <div className="text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold mb-2">投递完成！</h2>
            <p className="text-gray-500">
              共投递 {results.length} 个岗位，
              成功 <span className="text-green-600 font-medium">{results.filter(r => r.status === "sent").length}</span> 个，
              失败 <span className="text-red-600 font-medium">{results.filter(r => r.status === "error").length}</span> 个
            </p>
          </div>

          <div className="space-y-3">
            {results.map((job, i) => (
              <div key={i} className={`bg-white rounded-xl border p-4 flex items-center justify-between ${
                job.status === "sent" ? "border-green-200" : "border-red-200"
              }`}>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold truncate">{job.title}</h3>
                  <p className="text-sm text-gray-500 truncate">{job.company} · {job.salary}</p>
                </div>
                <div className="text-right ml-3 flex-shrink-0">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    job.status === "sent" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>
                    {job.status === "sent" ? "✅ 已发送" : "❌ 失败"}
                  </span>
                  {job.message && <p className="text-xs text-gray-400 mt-1">{job.message}</p>}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">安全提示</p>
                <p>建议等待至少 30 分钟后再进行下一轮投递。BOSS 直聘对高频操作有严格限制，保持低频率才能长期稳定使用。</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <button onClick={handleClose}
              className="px-6 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">
              关闭浏览器
            </button>
            <button onClick={() => { setStep("config"); setResults([]); setScreenshot(""); setTaskId(null) }}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
              继续投递
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-400">加载中...</div>}>
      <BossPage />
    </Suspense>
  )
}
