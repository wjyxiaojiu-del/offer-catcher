"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  ChevronLeft, Briefcase, Zap, TrendingUp,
  BookOpen, Target, Award, ArrowRight, Loader2, Brain,
  CheckCircle2, XCircle, AlertCircle
} from "lucide-react"
import { RadarChart } from "@/components/radar-chart"
import { cn } from "@/lib/utils"
import type { ParsedResume } from "@/types"

interface JobDirection {
  title: string
  matchScore: number
  reason: string
  tags: string[]
}

interface GapAnalysis {
  matched: string[]
  missing: string[]
  partial: string[]
}

interface RoadmapItem {
  phase: string
  duration: string
  skills: string[]
  milestone: string
}

function CareerPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resumeId = searchParams.get("resumeId")

  const [resume, setResume] = useState<ParsedResume | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [competencyData, setCompetencyData] = useState<{ label: string; value: number }[]>([])
  const [directions, setDirections] = useState<JobDirection[]>([])
  const [gap, setGap] = useState<GapAnalysis | null>(null)
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([])

  useEffect(() => {
    if (!resumeId) {
      setError("请先上传简历")
      setLoading(false)
      return
    }

    fetch(`/api/resume?id=${resumeId}`)
      .then(r => r.json())
      .then(data => {
        if (!data.resume) {
          setError("简历不存在")
          setLoading(false)
          return
        }
        setResume(data.resume)
        analyzeCareer(data.resume)
        setLoading(false)
      })
      .catch(() => {
        setError("加载失败")
        setLoading(false)
      })
  }, [resumeId])

  function analyzeCareer(resume: ParsedResume) {
    const skillCount = resume.skills.length
    const projectCount = resume.projects.length
    const expCount = resume.experience.length
    const eduLevel = resume.education[0]?.degree || ""
    const eduScore = eduLevel.includes("博士") ? 95 : eduLevel.includes("硕士") ? 85 : eduLevel.includes("本科") ? 75 : 60

    setCompetencyData([
      { label: "技术深度", value: Math.min(skillCount * 8 + 40, 95) },
      { label: "项目经验", value: Math.min(projectCount * 15 + 30, 90) },
      { label: "工作经历", value: Math.min(expCount * 12 + 40, 90) },
      { label: "学历背景", value: eduScore },
      { label: "技能广度", value: Math.min(skillCount * 6 + 50, 92) },
      { label: "综合竞争力", value: Math.min((skillCount * 5 + projectCount * 8 + expCount * 5 + eduScore * 0.3), 88) },
    ])

    const skillSet = new Set(resume.skills.map(s => s.toLowerCase()))
    const dirs: JobDirection[] = []

    if (skillSet.has("react") || skillSet.has("vue") || skillSet.has("angular") || skillSet.has("前端")) {
      dirs.push({
        title: "前端工程师",
        matchScore: 92,
        reason: "你的技术栈与前端岗位高度匹配，建议深入框架原理和性能优化",
        tags: ["React", "Vue", "TypeScript", "工程化"]
      })
    }
    if (skillSet.has("node.js") || skillSet.has("java") || skillSet.has("go") || skillSet.has("python") || skillSet.has("后端")) {
      dirs.push({
        title: "后端工程师",
        matchScore: 88,
        reason: "后端技能扎实，建议补充分布式系统和云原生技术",
        tags: ["微服务", "数据库", "高并发", "云原生"]
      })
    }
    if (skillSet.has("ai") || skillSet.has("pytorch") || skillSet.has("机器学习") || skillSet.has("大模型")) {
      dirs.push({
        title: "AI 工程师",
        matchScore: 85,
        reason: "AI 领域技能有基础，建议深化算法能力和工程落地经验",
        tags: ["LLM", "深度学习", "RAG", "MLOps"]
      })
    }
    if (skillSet.has("产品") || skillSet.has("figma") || skillSet.has("需求分析")) {
      dirs.push({
        title: "产品经理",
        matchScore: 78,
        reason: "具备产品思维和设计能力，建议加强数据分析和用户研究",
        tags: ["用户研究", "数据分析", "原型设计", "项目管理"]
      })
    }
    if (dirs.length === 0) {
      dirs.push(
        { title: "全栈工程师", matchScore: 75, reason: "技能分布较广，适合全栈方向发展", tags: ["前端", "后端", "DevOps"] },
        { title: "技术专员", matchScore: 70, reason: "建议选择一个技术方向深耕", tags: ["专精", "深耕", "技术专家"] }
      )
    }
    setDirections(dirs.slice(0, 3))

    setGap({
      matched: resume.skills.slice(0, Math.min(5, resume.skills.length)),
      missing: ["系统设计", "性能优化", "云原生"],
      partial: ["项目管理", "团队协作"]
    })

    setRoadmap([
      {
        phase: "第一阶段（1-3个月）",
        duration: "短期突破",
        skills: ["系统设计基础", "性能优化"],
        milestone: "完成2门核心课程，输出1篇技术博客"
      },
      {
        phase: "第二阶段（3-6个月）",
        duration: "能力深化",
        skills: ["云原生技术", "微服务架构"],
        milestone: "主导1个中型项目，通过技术认证"
      },
      {
        phase: "第三阶段（6-12个月）",
        duration: "全面发展",
        skills: ["技术影响力", "团队领导力"],
        milestone: "成为团队技术骨干，具备带人能力"
      },
    ])
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          正在分析职业规划...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            上传简历
          </button>
        </div>
      </div>
    )
  }

  if (!resume) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            返回首页
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">职业规划报告</h1>
              <p className="text-sm text-gray-500 mt-1">
                {resume.name} · {resume.education[0]?.school} · {resume.skills.length} 项技能
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/match?resumeId=${resumeId}`}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                查看岗位匹配
              </Link>
            </div>
          </div>
        </div>

        {/* Competency Radar */}
        <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            竞争力评估
          </h2>
          <div className="flex items-center justify-center py-4">
            <RadarChart data={competencyData} size={280} />
          </div>
        </div>

        {/* Job Directions */}
        <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-600" />
            推荐岗位方向
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {directions.map((dir, idx) => (
              <div
                key={idx}
                className={cn(
                  "border rounded-xl p-4 transition-all hover:shadow-md",
                  idx === 0 ? "border-blue-200 bg-blue-50/50" : "border-gray-200"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{dir.title}</h3>
                  <span className={cn(
                    "text-sm font-bold",
                    dir.matchScore >= 90 ? "text-emerald-600" : dir.matchScore >= 80 ? "text-blue-600" : "text-amber-600"
                  )}>
                    {dir.matchScore}%
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-3">{dir.reason}</p>
                <div className="flex flex-wrap gap-1">
                  {dir.tags.map((tag, tidx) => (
                    <span key={tidx} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Skills Gap */}
        {gap && (
          <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-600" />
              技能差距分析
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-emerald-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800">已掌握</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {gap.matched.length > 0 ? gap.matched.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">{s}</span>
                  )) : <span className="text-xs text-emerald-600">基础技能已覆盖</span>}
                </div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-red-800">待学习</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {gap.missing.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">{s}</span>
                  ))}
                </div>
              </div>
              <div className="bg-amber-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">待加强</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {gap.partial.length > 0 ? gap.partial.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">{s}</span>
                  )) : <span className="text-xs text-amber-600">暂无部分掌握技能</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Learning Roadmap */}
        <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            学习路线图
          </h2>
          <div className="space-y-4">
            {roadmap.map((item, idx) => (
              <div key={idx} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
                    {idx + 1}
                  </div>
                  {idx < roadmap.length - 1 && (
                    <div className="w-0.5 h-full bg-blue-100 mt-1" />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-gray-900">{item.phase}</h3>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{item.duration}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {item.skills.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{s}</span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Award className="w-3 h-3" />
                    里程碑：{item.milestone}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Industry Insights */}
        <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-600" />
            行业洞察
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                市场需求趋势
              </h3>
              <p className="text-xs text-gray-600">
                当前技术栈在招聘市场需求稳定，AI 相关岗位增长迅速。
                建议关注 LLM 应用开发和云原生技术方向。
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                核心竞争力建议
              </h3>
              <p className="text-xs text-gray-600">
                技术深度 + 工程能力 + 业务理解是长期竞争力的三大支柱。
                建议在巩固技术的同时，提升产品思维和沟通能力。
              </p>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-center gap-4 pb-8">
          <Link
            href={`/match?resumeId=${resumeId}`}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            查看匹配岗位
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/interview"
            className="px-6 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            开始模拟面试
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          加载中...
        </div>
      </div>
    }>
      <CareerPageContent />
    </Suspense>
  )
}
