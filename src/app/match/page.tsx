"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { CountUp } from "@/components/count-up"
import { RadarChart } from "@/components/radar-chart"
import { MatchCardSkeleton, StatsSkeleton, ResumeSkeleton } from "@/components/skeleton"

interface ParsedResume {
  name: string; email: string; phone: string; skills: string[]
  education: { school: string; major: string; degree: string }[]
  experience: { company: string; title: string; duration: string }[]
}

interface MatchResult {
  job: any
  score: number
  skillMatch: number
  educationMatch: number
  experienceMatch: number
  keywordMatch: number
  matchedSkills: string[]
  missingSkills: string[]
  suggestions: string[]
  aiAnalysis: string
  matchLevel: string
}

export default function MatchPage() {
  const [resume, setResume] = useState<ParsedResume | null>(null)
  const [results, setResults] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<MatchResult | null>(null)
  const [filter, setFilter] = useState("all")
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const text = sessionStorage.getItem("resumeText")
    if (!text) { router.push("/"); return }

    fetch("/api/resume", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })
      .then(r => r.json())
      .then(data => {
        setResume(data.resume)
        return fetch("/api/match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resume: data.resume }) })
      })
      .then(r => r.json())
      .then(data => { setResults(data.results); setLoading(false) })
      .catch(() => setLoading(false))
  }, [router])

  const handleApply = async (jobId: string, jobTitle: string, company: string) => {
    setApplyingId(jobId)
    try {
      const res = await fetch("/api/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, resumeName: resume?.name }) })
      const data = await res.json()
      if (data.success) {
        const stored = JSON.parse(localStorage.getItem("applications") || "[]")
        stored.unshift(data.application)
        localStorage.setItem("applications", JSON.stringify(stored))
        alert(`✅ 投递成功！\n岗位: ${jobTitle}\n公司: ${company}\n状态: 已投递\n\n可在「投递记录」页面查看状态`)
      }
    } catch { alert("投递失败，请重试") }
    setApplyingId(null)
  }

  const filteredResults = filter === "all" ? results
    : filter === "excellent" ? results.filter(r => r.score >= 80)
    : filter === "high" ? results.filter(r => r.score >= 60 && r.score < 80)
    : filter === "medium" ? results.filter(r => r.score >= 40 && r.score < 60)
    : results.filter(r => r.score < 40)

  const stats = {
    total: results.length,
    excellent: results.filter(r => r.score >= 80).length,
    good: results.filter(r => r.score >= 60 && r.score < 80).length,
    fair: results.filter(r => r.score >= 40 && r.score < 60).length,
    weak: results.filter(r => r.score < 40).length,
  }

  // Loading state with Skeleton
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        <ResumeSkeleton />
        <div className="mt-6"><StatsSkeleton /></div>
        <div className="mt-6 grid lg:grid-cols-2 gap-4">
          {[0, 1, 2, 3, 4, 5].map(i => <MatchCardSkeleton key={i} />)}
        </div>
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 text-center animate-pulse">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-blue-200 rounded-full" />
              <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-2 border-4 border-purple-400 border-b-transparent rounded-full animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
            </div>
            <p className="text-lg font-bold text-gray-700">AI 正在分析简历...</p>
            <p className="text-sm text-gray-500 mt-1">解析技能 · 匹配岗位 · 生成报告</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 animate-slide-up">
      {/* Resume Summary */}
      {resume && (
        <div className="bg-white rounded-xl border p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span className="text-xl">📋</span> 简历解析结果
            </h2>
            <button onClick={() => router.push("/")}
              className="text-sm text-blue-600 hover:text-blue-800 underline underline-offset-2 self-start">
              重新上传
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {[
              { label: "姓名", value: resume.name || "未识别", icon: "👤" },
              { label: "学历", value: `${resume.education[0]?.degree || "未填写"} · ${resume.education[0]?.school || ""}`, icon: "🎓" },
              { label: "技能", value: `${resume.skills.length} 项`, icon: "⚡" },
              { label: "经历", value: `${resume.experience.length} 段`, icon: "💼" },
            ].map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3">
                <span className="text-gray-500 text-xs">{item.icon} {item.label}</span>
                <p className="font-medium mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
          {resume.skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {resume.skills.map((s, i) => (
                <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">{s}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats Bar with CountUp */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: "全部", count: stats.total, filter: "all", color: "from-gray-50 to-gray-100", border: "border-gray-200" },
          { label: "高度匹配", count: stats.excellent, filter: "excellent", color: "from-green-50 to-green-100", border: "border-green-200" },
          { label: "较好匹配", count: stats.good, filter: "high", color: "from-blue-50 to-blue-100", border: "border-blue-200" },
          { label: "一般匹配", count: stats.fair, filter: "medium", color: "from-yellow-50 to-yellow-100", border: "border-yellow-200" },
          { label: "匹配度低", count: stats.weak, filter: "low", color: "from-red-50 to-red-100", border: "border-red-200" },
        ].map(item => (
          <button key={item.filter} onClick={() => setFilter(item.filter)}
            className={`rounded-xl p-3 text-center transition-all bg-gradient-to-b ${item.color} border ${item.border}
              ${filter === item.filter ? "ring-2 ring-blue-500 shadow-md scale-[1.02]" : "hover:shadow-sm"}`}>
            <div className="text-2xl font-bold"><CountUp end={item.count} duration={800} /></div>
            <div className="text-xs mt-0.5 text-gray-600">{item.label}</div>
          </button>
        ))}
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">匹配结果 ({filteredResults.length})</h2>
        <button onClick={() => router.push("/auto-apply")}
          className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all active:scale-95">
          🚀 一键批量投递
        </button>
      </div>

      {/* Results */}
      <div className="grid lg:grid-cols-2 gap-4">
        {filteredResults.map((result, i) => (
          <div key={result.job.id}
            className={`bg-white rounded-xl border overflow-hidden transition-all cursor-pointer animate-scale-in
              ${selectedJob?.job.id === result.job.id ? "ring-2 ring-blue-500 shadow-lg" : "hover:shadow-md"}`}
            style={{ animationDelay: `${i * 40}ms` }}
            onClick={() => setSelectedJob(selectedJob?.job.id === result.job.id ? null : result)}>
            <div className="p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold">{result.job.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      result.matchLevel === "excellent" ? "bg-green-100 text-green-700" :
                      result.matchLevel === "good" ? "bg-blue-100 text-blue-700" :
                      result.matchLevel === "fair" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {result.matchLevel === "excellent" ? "高度匹配" :
                       result.matchLevel === "good" ? "较好匹配" :
                       result.matchLevel === "fair" ? "一般匹配" : "匹配度低"}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm mt-1">{result.job.company} · {result.job.location} · {result.job.salary}</p>
                </div>
                <div className="text-right ml-3">
                  <div className={`text-3xl font-bold ${
                    result.score >= 80 ? "text-green-600" : result.score >= 60 ? "text-blue-600" : result.score >= 40 ? "text-yellow-600" : "text-red-500"
                  }`}>
                    <CountUp end={result.score} duration={1000 + i * 100} suffix="%" />
                  </div>
                </div>
              </div>

              {/* Score Bars */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[
                  ["技能", result.skillMatch, "🎯"],
                  ["学历", result.educationMatch, "🎓"],
                  ["经验", result.experienceMatch, "💼"],
                  ["关键词", result.keywordMatch, "🔑"],
                ].map(([label, score, icon]) => (
                  <div key={label as string} className="text-center">
                    <div className="text-xs text-gray-500 mb-1">{icon} {label}</div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-1000 ${
                        (score as number) >= 70 ? "bg-green-500" : (score as number) >= 40 ? "bg-yellow-500" : "bg-red-400"
                      }`} style={{ width: `${score}%` }} />
                    </div>
                    <div className="text-xs font-medium mt-0.5">{score}%</div>
                  </div>
                ))}
              </div>

              {/* AI Analysis Preview */}
              <p className="text-xs text-gray-600 leading-relaxed line-clamp-2 mb-3">
                🤖 {result.aiAnalysis}
              </p>

              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">{result.job.experience} · {result.job.education}</div>
                <div className="flex gap-2">
                  <button onClick={(e) => { e.stopPropagation(); handleApply(result.job.id, result.job.title, result.job.company) }}
                    disabled={applyingId === result.job.id}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 active:scale-95">
                    {applyingId === result.job.id ? "投递中..." : "投递"}
                  </button>
                </div>
              </div>
            </div>

            {/* Expanded Details with Radar Chart */}
            {selectedJob?.job.id === result.job.id && (
              <div className="border-t bg-gray-50/50 p-5 animate-slide-up">
                {/* Radar Chart */}
                <div className="flex flex-col sm:flex-row items-center gap-6 mb-4">
                  <div className="flex-shrink-0">
                    <RadarChart
                      data={[
                        { label: "技能", value: result.skillMatch, color: "#22c55e" },
                        { label: "学历", value: result.educationMatch, color: "#3b82f6" },
                        { label: "经验", value: result.experienceMatch, color: "#f59e0b" },
                        { label: "关键词", value: result.keywordMatch, color: "#8b5cf6" },
                      ]}
                      size={200}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-blue-800 mb-1">🤖 AI 分析报告</p>
                      <p className="text-xs text-blue-700 leading-relaxed">{result.aiAnalysis}</p>
                    </div>
                    {/* Matched Skills */}
                    {result.matchedSkills.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-green-700 mb-1">✅ 已匹配 ({result.matchedSkills.length})</p>
                        <div className="flex flex-wrap gap-1">
                          {result.matchedSkills.map((s, j) => <span key={j} className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">{s}</span>)}
                        </div>
                      </div>
                    )}
                    {result.missingSkills.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-red-700 mb-1">❌ 缺失 ({result.missingSkills.length})</p>
                        <div className="flex flex-wrap gap-1">
                          {result.missingSkills.map((s, j) => <span key={j} className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs">{s}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Suggestions */}
                <div className="mb-3">
                  <p className="text-xs font-medium text-purple-700 mb-1">💡 优化建议</p>
                  {result.suggestions.map((s, j) => <p key={j} className="text-xs text-gray-600 ml-2 leading-relaxed">• {s}</p>)}
                </div>

                {/* Job Details */}
                <div className="bg-white rounded-lg p-3 border">
                  <p className="text-xs font-medium text-gray-700 mb-1">📝 岗位描述</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{result.job.description}</p>
                  {result.job.skills && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {result.job.skills.map((s: string, j: number) => <span key={j} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{s}</span>)}
                    </div>
                  )}
                  {result.job.benefits && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-gray-700 mb-1">🎁 福利</p>
                      <div className="flex flex-wrap gap-1">
                        {result.job.benefits.map((b: string, j: number) => <span key={j} className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs">{b}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
