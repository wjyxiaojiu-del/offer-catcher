"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { CountUp } from "@/components/count-up"
import { RadarChart } from "@/components/radar-chart"
import { useToast } from "@/components/ui/toast"
import type { ParsedResume, ReportSection } from "@/types"

export default function JDOptimizePage() {
  const [resume, setResume] = useState<ParsedResume | null>(null)
  const [jdText, setJdText] = useState("")
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<{ overall: string; overallScore: number; sections: ReportSection[] } | null>(null)
  const [parsedJob, setParsedJob] = useState<any>(null)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const text = sessionStorage.getItem("resumeText")
    if (!text) { router.push("/"); return }

    fetch("/api/resume", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })
      .then(r => r.json())
      .then(data => setResume(data.resume))
      .catch(() => router.push("/"))
  }, [router])

  const handleAnalyze = async () => {
    if (!resume || !jdText.trim()) return
    setLoading(true)

    try {
      const res = await fetch("/api/jd-optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, jdText })
      })
      const data = await res.json()
      if (data.report) {
        setReport(data.report)
        setParsedJob(data.job)
      } else {
        toast(data.error || "分析失败", "error")
      }
    } catch {
      toast("请求失败，请重试", "error")
    }
    setLoading(false)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 animate-slide-up">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold">🎯 针对 JD 简历优化</h1>
        <p className="text-gray-500 mt-2">粘贴你心仪岗位的 JD，AI 帮你分析简历匹配度并给出优化建议</p>
      </div>

      {/* Resume Info */}
      {resume && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-800">
            <span className="font-medium">当前简历:</span> {resume.name} · {resume.skills.length} 项技能 · {resume.experience.length} 段经历
          </p>
        </div>
      )}

      {/* JD Input */}
      <div className="bg-white rounded-xl border p-5 mb-6">
        <label className="block font-bold mb-2">📝 粘贴岗位描述 (JD)</label>
        <p className="text-sm text-gray-500 mb-3">从招聘网站复制完整的岗位描述，包括岗位职责、任职要求等</p>
        <textarea
          className="w-full h-56 border rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder={`示例：\n前端开发工程师\n公司：某科技有限公司\n地点：北京\n薪资：25K-40K\n\n岗位职责：\n1. 负责公司核心产品的前端开发\n2. 参与技术方案设计和代码评审\n\n任职要求：\n1. 熟悉 React/Vue 等主流框架\n2. 熟悉 TypeScript\n3. 了解前端工程化\n4. 有大型项目经验优先`}
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
        />
        <div className="mt-3 flex justify-between items-center">
          <span className="text-xs text-gray-400">{jdText.length} 字</span>
          <button onClick={handleAnalyze}
            disabled={!jdText.trim() || loading}
            className={`px-6 py-2.5 rounded-xl font-medium text-white transition-all ${
              jdText.trim() && !loading
                ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-lg active:scale-95"
                : "bg-gray-300 cursor-not-allowed"
            }`}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                分析中...
              </span>
            ) : "🔍 开始分析"}
          </button>
        </div>
      </div>

      {/* Results */}
      {report && parsedJob && (
        <div className="space-y-6 animate-slide-up">
          {/* Parsed JD Summary */}
          <div className="bg-white rounded-xl border p-5">
            <h2 className="font-bold mb-3">📋 JD 解析结果</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-gray-500 text-xs">岗位</span>
                <p className="font-medium mt-0.5">{parsedJob.title}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-gray-500 text-xs">公司</span>
                <p className="font-medium mt-0.5">{parsedJob.company}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-gray-500 text-xs">薪资</span>
                <p className="font-medium mt-0.5">{parsedJob.salary}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-gray-500 text-xs">要求</span>
                <p className="font-medium mt-0.5">{parsedJob.experience} · {parsedJob.education}</p>
              </div>
            </div>
            {parsedJob.skills.length > 0 && (
              <div className="mt-3">
                <span className="text-xs text-gray-500">识别到的技能关键词:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {parsedJob.skills.map((s: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Overall Score with Radar */}
          <div className="bg-white rounded-xl border p-5">
            <h2 className="font-bold mb-4">🎯 综合匹配分析</h2>
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <RadarChart
                data={report.sections.slice(0, 5).map(s => ({
                  label: s.title.replace("度", ""),
                  value: s.score,
                  color: s.score >= 70 ? "#22c55e" : s.score >= 40 ? "#f59e0b" : "#ef4444"
                }))}
                size={200}
              />
              <div className="flex-1 text-center sm:text-left">
                <div className="text-5xl font-bold mb-2">
                  <CountUp end={report.overallScore} suffix="%" className={
                    report.overallScore >= 70 ? "text-green-600" :
                    report.overallScore >= 40 ? "text-yellow-600" : "text-red-500"
                  } />
                </div>
                <p className="text-gray-600 leading-relaxed">{report.overall}</p>
              </div>
            </div>
          </div>

          {/* Detailed Sections */}
          <div className="grid sm:grid-cols-2 gap-4">
            {report.sections.map((section, i) => (
              <div key={i} className="bg-white rounded-xl border p-5 animate-scale-in" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold">{section.icon} {section.title}</h3>
                  <span className={`text-xl font-bold ${
                    section.score >= 70 ? "text-green-600" : section.score >= 40 ? "text-yellow-600" : "text-red-500"
                  }`}>
                    <CountUp end={section.score} suffix="%" duration={800 + i * 100} />
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                  <div className={`h-full rounded-full transition-all duration-1000 ${
                    section.score >= 70 ? "bg-green-500" : section.score >= 40 ? "bg-yellow-500" : "bg-red-400"
                  }`} style={{ width: `${section.score}%` }} />
                </div>
                <p className="text-sm text-gray-600 mb-2">{section.feedback}</p>
                <div className="space-y-1">
                  {section.improvements.map((imp, j) => (
                    <p key={j} className="text-xs text-gray-500">• {imp}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4">
            <button onClick={() => { setReport(null); setJdText("") }}
              className="px-6 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
              分析其他 JD
            </button>
            <button onClick={() => router.push("/match")}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
              查看全量匹配
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
