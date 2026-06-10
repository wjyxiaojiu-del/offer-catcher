"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useToast } from "@/components/ui/toast"
import type { ParsedResume, AutoApplyResult } from "@/types"

function AutoApplyPage() {
  const [resume, setResume] = useState<ParsedResume | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AutoApplyResult | null>(null)
  const [showResult, setShowResult] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // Config state
  const [minScore, setMinScore] = useState(60)
  const [maxApplications, setMaxApplications] = useState(10)
  const [locations, setLocations] = useState<string[]>([])
  const [salaryMin, setSalaryMin] = useState(0)
  const [excludeCompanies, setExcludeCompanies] = useState<string[]>([])
  const [jobTypes, setJobTypes] = useState<string[]>([])

  const allLocations = ["北京", "上海", "深圳", "杭州", "广州", "成都", "长沙", "武汉", "南京"]
  const allJobTypes = ["互联网", "AI", "大厂", "前端", "后端", "数据", "产品", "设计", "运营", "农业", "硬件", "游戏", "安全"]
  const allCompanies = ["字节跳动", "阿里巴巴", "百度", "美团", "腾讯", "华为", "小米", "拼多多", "网易", "大疆", "快手", "Bilibili"]

  useEffect(() => {
    const resumeId = searchParams.get("resumeId")
    if (!resumeId) { router.push("/"); return }

    fetch(`/api/resume?id=${resumeId}`)
      .then(r => r.json())
      .then(data => {
        if (!data.resume) { router.push("/"); return }
        setResume(data.resume)
      })
      .catch(() => router.push("/"))
  }, [router, searchParams])

  const toggleItem = (arr: string[], setArr: (v: string[]) => void, item: string) => {
    setArr(arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item])
  }

  const handleAutoApply = async () => {
    if (!resume) return

    setLoading(true)
    try {
      const res = await fetch("/api/auto-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume,
          config: { minScore, maxApplications, locations, salaryMin, excludeCompanies, jobTypes }
        })
      })
      const data = await res.json()
      setResult(data)
      setShowResult(true)
    } catch {
      toast("自动投递失败，请重试", "error")
    }
    setLoading(false)
  }

  if (showResult && result) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">{result.totalApplied > 0 ? "🎉" : "😅"}</div>
          <h1 className="text-2xl font-bold mb-2">
            {result.totalApplied > 0 ? "自动投递完成！" : "暂无符合条件的岗位"}
          </h1>
          <p className="text-gray-500">
            {result.totalApplied > 0
              ? `已成功投递 ${result.totalApplied} 个岗位`
              : "尝试降低匹配分数或放宽筛选条件"}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{result.totalMatched}</div>
            <div className="text-sm text-gray-500 mt-1">匹配岗位</div>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{result.totalQualified}</div>
            <div className="text-sm text-gray-500 mt-1">符合条件</div>
          </div>
          <div className="bg-white rounded-xl border p-4 text-center">
            <div className="text-3xl font-bold text-orange-600">{result.totalApplied}</div>
            <div className="text-sm text-gray-500 mt-1">已投递</div>
          </div>
        </div>

        {/* Applied Jobs */}
        {result.applications.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold mb-4">✅ 已投递岗位</h2>
            <div className="space-y-3">
              {result.applications.map((app: any) => (
                <div key={app.id} className="bg-white rounded-xl border p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
                  <div>
                    <h3 className="font-bold">{app.jobTitle}</h3>
                    <p className="text-sm text-gray-500">{app.company} · {app.location} · {app.salary}</p>
                    <p className="text-xs text-gray-400 mt-1">匹配度: {app.score}%</p>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">已投递</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skipped Jobs */}
        {result.skippedJobs.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold mb-4">⏭️ 跳过的岗位</h2>
            <div className="space-y-2">
              {result.skippedJobs.map((job: any, i: number) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between text-sm">
                  <span>{job.title} · {job.company} (匹配度 {job.score}%)</span>
                  <span className="text-gray-400 text-xs">{job.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-center gap-4">
          <button onClick={() => { setShowResult(false); setResult(null) }}
            className="px-6 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            调整策略重新投递
          </button>
          <button onClick={() => router.push("/applications")}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
            查看投递记录
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-center mb-8 animate-fade-in">
        <h1 className="text-2xl font-bold">🚀 一键批量投递</h1>
        <p className="text-gray-500 mt-2">设置投递策略，AI 自动筛选并批量投递匹配岗位</p>
      </div>

      {resume && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 animate-fade-in">
          <p className="text-sm text-blue-800">
            <span className="font-medium">当前简历:</span> {resume.name} · {resume.skills.length} 项技能 · {resume.experience.length} 段经历
          </p>
        </div>
      )}

      <div className="space-y-6 animate-fade-in">
        {/* Min Score */}
        <div className="bg-white rounded-xl border p-5">
          <label className="block font-bold mb-2">📊 最低匹配分数</label>
          <p className="text-sm text-gray-500 mb-3">只投递匹配度高于此分数的岗位</p>
          <div className="flex items-center gap-4">
            <input type="range" min={30} max={90} step={5} value={minScore}
              onChange={(e) => setMinScore(parseInt(e.target.value))}
              className="flex-1 accent-blue-600" />
            <span className="text-lg font-bold text-blue-600 w-12 text-right">{minScore}%</span>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>30% 宽松</span>
            <span>60% 适中</span>
            <span>90% 严格</span>
          </div>
        </div>

        {/* Max Applications */}
        <div className="bg-white rounded-xl border p-5">
          <label className="block font-bold mb-2">📮 最多投递数量</label>
          <p className="text-sm text-gray-500 mb-3">单次批量投递的岗位上限</p>
          <div className="flex items-center gap-4">
            <input type="range" min={1} max={25} step={1} value={maxApplications}
              onChange={(e) => setMaxApplications(parseInt(e.target.value))}
              className="flex-1 accent-blue-600" />
            <span className="text-lg font-bold text-blue-600 w-12 text-right">{maxApplications}</span>
          </div>
        </div>

        {/* Salary */}
        <div className="bg-white rounded-xl border p-5">
          <label className="block font-bold mb-2">💰 最低薪资要求 (K)</label>
          <p className="text-sm text-gray-500 mb-3">过滤掉低于此薪资的岗位</p>
          <div className="flex items-center gap-4">
            <input type="range" min={0} max={30} step={5} value={salaryMin}
              onChange={(e) => setSalaryMin(parseInt(e.target.value))}
              className="flex-1 accent-blue-600" />
            <span className="text-lg font-bold text-blue-600 w-16 text-right">{salaryMin === 0 ? "不限" : `${salaryMin}K`}</span>
          </div>
        </div>

        {/* Locations */}
        <div className="bg-white rounded-xl border p-5">
          <label className="block font-bold mb-2">📍 期望城市</label>
          <p className="text-sm text-gray-500 mb-3">不选则不限城市</p>
          <div className="flex flex-wrap gap-2">
            {allLocations.map(loc => (
              <button key={loc} onClick={() => toggleItem(locations, setLocations, loc)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  locations.includes(loc) ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {loc}
              </button>
            ))}
          </div>
        </div>

        {/* Job Types */}
        <div className="bg-white rounded-xl border p-5">
          <label className="block font-bold mb-2">🏷️ 岗位类型</label>
          <p className="text-sm text-gray-500 mb-3">不选则不限类型</p>
          <div className="flex flex-wrap gap-2">
            {allJobTypes.map(type => (
              <button key={type} onClick={() => toggleItem(jobTypes, setJobTypes, type)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  jobTypes.includes(type) ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Exclude Companies */}
        <div className="bg-white rounded-xl border p-5">
          <label className="block font-bold mb-2">🚫 排除公司</label>
          <p className="text-sm text-gray-500 mb-3">选中的公司不会被投递</p>
          <div className="flex flex-wrap gap-2">
            {allCompanies.map(company => (
              <button key={company} onClick={() => toggleItem(excludeCompanies, setExcludeCompanies, company)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  excludeCompanies.includes(company) ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {company}
              </button>
            ))}
          </div>
        </div>

        {/* Summary & Submit */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border p-5">
          <h3 className="font-bold mb-2">📋 投递策略摘要</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• 匹配分数 ≥ {minScore}%</li>
            <li>• 最多投递 {maxApplications} 个岗位</li>
            <li>• 薪资要求: {salaryMin === 0 ? "不限" : `≥ ${salaryMin}K`}</li>
            <li>• 城市: {locations.length === 0 ? "不限" : locations.join("、")}</li>
            <li>• 类型: {jobTypes.length === 0 ? "不限" : jobTypes.join("、")}</li>
            {excludeCompanies.length > 0 && <li>• 排除: {excludeCompanies.join("、")}</li>}
          </ul>
        </div>

        <button onClick={handleAutoApply} disabled={loading}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all disabled:opacity-50 active:scale-[0.99]">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              AI 正在筛选并投递...
            </span>
          ) : "🚀 开始自动投递"}
        </button>

        <p className="text-center text-xs text-gray-400">
          注: 系统将从岗位库中智能匹配并记录投递，实际简历投递请前往 BOSS 直聘页面
        </p>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-400">加载中...</div>}>
      <AutoApplyPage />
    </Suspense>
  )
}
