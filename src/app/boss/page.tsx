"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import type { BossJob } from "@/types"

type Step = "init" | "login" | "config" | "searching" | "results" | "applying" | "done"

export default function BossPage() {
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
  const [maxApply, setMaxApply] = useState(10)
  const [greeting, setGreeting] = useState("")
  const [minSalary, setMinSalary] = useState(0)

  const router = useRouter()
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const text = sessionStorage.getItem("resumeText")
    if (!text) { router.push("/"); return }

    fetch("/api/resume", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })
      .then(r => r.json())
      .then(data => {
        setResume(data.resume)
        if (data.resumeId) sessionStorage.setItem("resumeId", data.resumeId)
        if (data.resume?.skills?.length > 0) {
          setKeywords(data.resume.skills.slice(0, 3).join(" "))
        }
      })
      .catch(() => {})
  }, [router])

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const apiCall = async (body: any) => {
    const res = await fetch("/api/boss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return res.json()
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
        // Start polling for login status
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
    try {
      const data = await apiCall({
        action: "search",
        config: { keywords, city, maxApply, minSalary: minSalary || undefined },
      })
      setJobs(data.jobs || [])
      setStep("results")
    } catch (err: any) {
      setError(err.message || "搜索失败")
      setStep("config")
    }
    setLoading(false)
  }

  const handleApply = async () => {
    setStep("applying")
    setLoading(true)
    setError("")
    try {
      const resumeId = sessionStorage.getItem("resumeId")
      const data = await apiCall({
        action: "apply",
        config: { keywords, city, maxApply, greeting: greeting || undefined, minSalary: minSalary || undefined },
        resumeSkills: resume?.skills || [],
        resumeId,
      })
      setResults(data.results || [])
      setStep("done")
    } catch (err: any) {
      setError(err.message || "投递失败")
      setStep("results")
    }
    setLoading(false)
  }

  const handleClose = async () => {
    await apiCall({ action: "close" })
    setStep("init")
    setJobs([])
    setResults([])
  }

  const cities = ["北京", "上海", "深圳", "杭州", "广州", "成都", "南京", "武汉", "西安", "苏州", "长沙", "重庆"]

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 animate-slide-up">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold">🤖 BOSS 直聘自动投递</h1>
        <p className="text-gray-500 mt-2">自动登录 BOSS 直聘，搜索岗位，批量打招呼投递</p>
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
          <h2 className="text-xl font-bold mb-2">启动自动投递</h2>
          <p className="text-gray-500 mb-6">将打开浏览器窗口，需要你用 BOSS 直聘 App 扫码登录</p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-yellow-800 font-medium mb-1">⚠️ 使用须知</p>
            <ul className="text-xs text-yellow-700 space-y-1">
              <li>• 会打开一个真实的 Chrome 浏览器窗口</li>
              <li>• 需要用 BOSS 直聘 App 扫码登录</li>
              <li>• 登录后会自动搜索岗位并发送招呼</li>
              <li>• 每次操作间隔 3-8 秒随机延迟，防止检测</li>
              <li>• 登录状态会保存，下次无需重新扫码</li>
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
                <label className="block text-sm font-medium mb-1">📮 最多投递</label>
                <input type="number" value={maxApply} onChange={e => setMaxApply(parseInt(e.target.value) || 10)}
                  min={1} max={50}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">💰 最低薪资 (K)</label>
                <input type="number" value={minSalary} onChange={e => setMinSalary(parseInt(e.target.value) || 0)}
                  min={0} placeholder="0 = 不限"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">📋 搜索结果 ({jobs.length} 个岗位)</h2>
            <div className="flex gap-2">
              <button onClick={() => setStep("config")} className="text-sm text-gray-500 hover:text-gray-700">返回修改</button>
              <button onClick={handleApply} disabled={jobs.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                🚀 开始批量投递 ({jobs.length})
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {jobs.map((job, i) => (
              <div key={i} className="bg-white rounded-xl border p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold truncate">{job.title}</h3>
                  <p className="text-sm text-gray-500 truncate">{job.company} · {job.location} · {job.salary}</p>
                  <p className="text-xs text-gray-400">{job.experience} · {job.education}</p>
                </div>
                <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs ml-3 flex-shrink-0">待投递</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step: Applying */}
      {step === "applying" && (
        <div className="bg-white rounded-xl border p-8 text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-green-200 rounded-full" />
            <div className="absolute inset-0 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-lg font-medium">正在批量投递...</p>
          <p className="text-sm text-gray-500 mt-1">请勿关闭浏览器窗口，每单操作间隔 3-8 秒</p>
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
              成功 {results.filter(r => r.status === "sent").length} 个，
              失败 {results.filter(r => r.status === "error").length} 个
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

          <div className="flex justify-center gap-4">
            <button onClick={handleClose}
              className="px-6 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">
              关闭浏览器
            </button>
            <button onClick={() => { setStep("config"); setResults([]) }}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
              继续投递
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
