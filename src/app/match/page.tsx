"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import {
  FileText, User, GraduationCap, Zap, Briefcase, Rocket,
  Target, KeyRound, Bot, CheckCircle2, XCircle, Lightbulb, Gift,
} from "lucide-react"
import { CountUp } from "@/components/count-up"
import { MatchCardSkeleton, StatsSkeleton, ResumeSkeleton } from "@/components/skeleton"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import type { ParsedResume, MatchResult } from "@/types"

const RadarChart = dynamic(
  () => import("@/components/radar-chart").then(m => ({ default: m.RadarChart })),
  {
    loading: () => <div className="h-[200px] w-[200px] bg-gray-100 rounded-full animate-pulse" />,
    ssr: false,
  }
)

const SCORE_CONFIG = [
  { label: "技能", key: "skillMatch" as const, icon: Target, color: "#22c55e" },
  { label: "学历", key: "educationMatch" as const, icon: GraduationCap, color: "#3b82f6" },
  { label: "经验", key: "experienceMatch" as const, icon: Briefcase, color: "#f59e0b" },
  { label: "关键词", key: "keywordMatch" as const, icon: KeyRound, color: "#8b5cf6" },
]

const LEVEL_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  excellent: { bg: "bg-green-100", text: "text-green-700", label: "高度匹配" },
  good: { bg: "bg-blue-100", text: "text-blue-700", label: "较好匹配" },
  fair: { bg: "bg-yellow-100", text: "text-yellow-700", label: "一般匹配" },
  weak: { bg: "bg-red-100", text: "text-red-700", label: "匹配度低" },
}

export default function MatchPage() {
  const [resume, setResume] = useState<ParsedResume | null>(null)
  const [results, setResults] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<MatchResult | null>(null)
  const [filter, setFilter] = useState("all")
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const text = sessionStorage.getItem("resumeText")
    const resumeId = sessionStorage.getItem("resumeId")
    if (!text) { router.push("/"); return }

    fetch("/api/resume", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })
      .then(r => r.json())
      .then(data => {
        setResume(data.resume)
        const body: Record<string, unknown> = { resume: data.resume }
        if (resumeId) body.resumeId = resumeId
        return fetch("/api/match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
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
        toast(`已投递「${jobTitle}」@${company}`, "success")
      }
    } catch { toast("投递失败，请重试", "error") }
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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        <ResumeSkeleton />
        <div className="mt-6"><StatsSkeleton /></div>
        <div className="mt-6 grid lg:grid-cols-2 gap-4">
          {[0, 1, 2, 3, 4, 5].map(i => <MatchCardSkeleton key={i} />)}
        </div>
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 text-center">
            <div className="relative w-14 h-14 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-gray-100 rounded-full" />
              <div className="absolute inset-0 border-4 border-gray-800 border-t-transparent rounded-full animate-spin" />
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
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900">
              <FileText className="w-5 h-5 text-gray-400" />
              简历解析结果
            </h2>
            <div className="flex gap-3 self-start">
              <button onClick={() => router.push("/resume/edit")}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                编辑简历
              </button>
              <button onClick={() => router.push("/")}
                className="text-sm text-gray-400 hover:text-gray-600 font-medium">
                重新上传
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {[
              { label: "姓名", value: resume.name || "未识别", icon: User },
              { label: "学历", value: `${resume.education[0]?.degree || "未填写"} · ${resume.education[0]?.school || ""}`, icon: GraduationCap },
              { label: "技能", value: `${resume.skills.length} 项`, icon: Zap },
              { label: "经历", value: `${resume.experience.length} 段`, icon: Briefcase },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                  <span className="text-gray-400 text-xs flex items-center gap-1"><Icon className="w-3 h-3" /> {item.label}</span>
                  <p className="font-medium text-gray-900 mt-0.5 truncate">{item.value}</p>
                </div>
              )
            })}
          </div>
          {resume.skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {resume.skills.map((s, i) => (
                <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">{s}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: "全部", count: stats.total, filter: "all", activeRing: "ring-gray-300" },
          { label: "高度匹配", count: stats.excellent, filter: "excellent", activeRing: "ring-green-400" },
          { label: "较好匹配", count: stats.good, filter: "high", activeRing: "ring-blue-400" },
          { label: "一般匹配", count: stats.fair, filter: "medium", activeRing: "ring-yellow-400" },
          { label: "匹配度低", count: stats.weak, filter: "low", activeRing: "ring-red-400" },
        ].map(item => (
          <button key={item.filter} onClick={() => setFilter(item.filter)}
            className={cn(
              "rounded-xl p-3 text-center transition-all border bg-white",
              filter === item.filter ? cn("ring-2 shadow-sm", item.activeRing) : "border-gray-100 hover:border-gray-200 hover:shadow-sm"
            )}>
            <div className="text-2xl font-bold text-gray-900"><CountUp end={item.count} duration={800} /></div>
            <div className="text-xs mt-0.5 text-gray-500">{item.label}</div>
          </button>
        ))}
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">匹配结果 ({filteredResults.length})</h2>
        <button onClick={() => router.push("/auto-apply")}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors active:scale-95 flex items-center gap-1.5">
          <Rocket className="w-3.5 h-3.5" />
          一键批量投递
        </button>
      </div>

      {/* Results */}
      <div className="grid lg:grid-cols-2 gap-4">
        {filteredResults.map((result, i) => {
          const level = LEVEL_STYLES[result.matchLevel] || LEVEL_STYLES.weak
          const isOpen = selectedJob?.job.id === result.job.id
          return (
            <div key={result.job.id}
              className={cn(
                "bg-white rounded-xl border overflow-hidden transition-all cursor-pointer",
                isOpen ? "ring-2 ring-blue-500 shadow-lg border-blue-200" : "border-gray-100 hover:border-gray-200 hover:shadow-sm"
              )}
              onClick={() => setSelectedJob(isOpen ? null : result)}>
              <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-gray-900">{result.job.title}</h3>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", level.bg, level.text)}>
                        {level.label}
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1">{result.job.company} · {result.job.location} · {result.job.salary}</p>
                  </div>
                  <div className="text-right ml-3">
                    <div className={cn("text-3xl font-bold",
                      result.score >= 80 ? "text-green-600" : result.score >= 60 ? "text-blue-600" : result.score >= 40 ? "text-yellow-600" : "text-red-500"
                    )}>
                      <CountUp end={result.score} duration={1000 + i * 100} suffix="%" />
                    </div>
                  </div>
                </div>

                {/* Score Bars */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {SCORE_CONFIG.map(({ label, key, icon: Icon }) => {
                    const score = result[key]
                    return (
                      <div key={label} className="text-center">
                        <div className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-0.5">
                          <Icon className="w-3 h-3" /> {label}
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all duration-1000",
                            score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-400"
                          )} style={{ width: `${score}%` }} />
                        </div>
                        <div className="text-xs font-medium mt-0.5 text-gray-700">{score}%</div>
                      </div>
                    )
                  })}
                </div>

                {/* AI Analysis Preview */}
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-3 flex items-start gap-1">
                  <Bot className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
                  {result.aiAnalysis}
                </p>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-400">{result.job.experience} · {result.job.education}</div>
                  <button onClick={(e) => { e.stopPropagation(); handleApply(result.job.id, result.job.title, result.job.company) }}
                    disabled={applyingId === result.job.id}
                    className="px-4 py-1.5 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 transition-colors disabled:opacity-50 active:scale-95">
                    {applyingId === result.job.id ? "投递中..." : "投递"}
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {isOpen && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-5 animate-slide-up">
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
                      <div className="bg-white rounded-lg p-3 border border-gray-100">
                        <p className="text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                          <Bot className="w-3.5 h-3.5" />
                          AI 分析报告
                          {result.aiPowered && <span className="ml-1 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">真实 AI</span>}
                        </p>
                        <p className="text-xs text-gray-600 leading-relaxed">{result.aiAnalysis}</p>
                      </div>
                      {result.matchedSkills.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-green-700 mb-1 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 已匹配 ({result.matchedSkills.length})
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {result.matchedSkills.map((s, j) => <span key={j} className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">{s}</span>)}
                          </div>
                        </div>
                      )}
                      {result.missingSkills.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-red-700 mb-1 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> 缺失 ({result.missingSkills.length})
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {result.missingSkills.map((s, j) => <span key={j} className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs">{s}</span>)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Suggestions */}
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Lightbulb className="w-3.5 h-3.5" /> 优化建议
                    </p>
                    {result.suggestions.map((s, j) => <p key={j} className="text-xs text-gray-500 ml-4 leading-relaxed list-disc">• {s}</p>)}
                  </div>

                  {/* Job Details */}
                  <div className="bg-white rounded-lg p-3 border border-gray-100">
                    <p className="text-xs font-medium text-gray-700 mb-1">岗位描述</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{result.job.description}</p>
                    {result.job.skills && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {result.job.skills.map((s: string, j: number) => <span key={j} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{s}</span>)}
                      </div>
                    )}
                    {result.job.benefits && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                          <Gift className="w-3.5 h-3.5" /> 福利
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {result.job.benefits.map((b: string, j: number) => <span key={j} className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs">{b}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
