'use client'

import { useState, useEffect } from "react"
import Link from "next/link"
import { Target, Bot, BarChart3, Send, MessageSquare, ArrowRight, Sparkles } from "lucide-react"
import { CountUp } from "@/components/count-up"
import { UploadSection } from "@/components/home/upload-section"
import { cn } from "@/lib/utils"

interface SiteStats {
  jobs: number
  questions: number
  applications: number
}

const FALLBACK_STATS: SiteStats = {
  jobs: 25,
  questions: 0,
  applications: 0,
}

const FEATURES = [
  { icon: Target, title: "智能岗位匹配", desc: "基于多维度算法分析简历与 JD 的匹配度，精准推荐最适合的岗位" },
  { icon: Bot, title: "AI 分析报告", desc: "生成详细的 AI 分析报告，告诉你为什么匹配、哪里需要提升" },
  { icon: BarChart3, title: "简历优化建议", desc: "逐项对比简历与岗位要求，给出具体的优化方向和关键词建议" },
  { icon: Send, title: "一键批量投递", desc: "设置投递策略后自动筛选并批量投递，告别重复操作" },
  { icon: MessageSquare, title: "AI 求职 Agent", desc: "自然语言对话式求职助手，任务分解、工具调用、记忆管理" },
]

const STEPS = [
  { step: "01", title: "上传简历", desc: "支持 PDF/DOCX/TXT 或直接粘贴文本" },
  { step: "02", title: "AI 分析匹配", desc: "多维度分析简历，匹配 25+ 岗位" },
  { step: "03", title: "查看报告", desc: "查看匹配度、雷达图、AI 分析" },
  { step: "04", title: "一键投递", desc: "选择心仪岗位或批量自动投递" },
  { step: "05", title: "Agent 持续跟进", desc: "Agent 记住你的偏好，持续推荐和优化" },
]

export default function Home() {
  const [stats, setStats] = useState<SiteStats>(FALLBACK_STATS)

  useEffect(() => {
    fetch('/api/stats')
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) return
        if (data && typeof data.jobs === 'number') {
          setStats(data)
        }
      })
      .catch(() => {
        // 保持 fallback
      })
  }, [])

  const HERO_STATS = [
    { value: stats.jobs, suffix: "+", label: "热门岗位" },
    { value: stats.questions, suffix: "+", label: "面试真题" },
    { value: stats.applications, suffix: "+", label: "已投递" },
    { value: 4, suffix: "维", label: "智能分析" },
  ]

  return (
    <div className="min-h-[calc(100vh-56px)]">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <div className="relative max-w-7xl mx-auto px-4 py-14 sm:py-20">
          <div className="text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-sm text-blue-700 mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              AI 驱动的智能求职匹配引擎
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900">
              Offer 捕手
            </h1>
            <p className="mt-4 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
              上传简历，AI 帮你智能匹配最合适的岗位<br className="hidden sm:block" />
              分析简历差距，一键批量投递，告别海投时代
            </p>

            {/* Agent CTA */}
            <div className="mt-6">
              <Link
                href="/agent"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-medium text-sm hover:bg-gray-800 hover:shadow-lg transition-all active:scale-95"
              >
                <MessageSquare className="w-4 h-4" />
                <span>与求职 Agent 对话</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* CountUp Stats */}
            <div className="mt-8 flex flex-wrap justify-center gap-6 sm:gap-10">
              {HERO_STATS.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-gray-900">
                    <CountUp end={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Upload Section */}
      <section className="max-w-3xl mx-auto px-4 -mt-5 relative z-10">
        <UploadSection />
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 py-14">
        <h2 className="text-2xl font-bold text-center mb-2 text-gray-900">核心功能</h2>
        <p className="text-center text-gray-500 text-sm mb-10">从简历解析到投递跟进，全流程智能化</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {FEATURES.map((f, i) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className={cn(
                  "bg-white rounded-xl p-5 border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all",
                  i === 0 && "delay-0",
                  i === 1 && "delay-75",
                  i === 2 && "delay-100",
                  i === 3 && "delay-150",
                  i === 4 && "delay-200"
                )}
              >
                <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center mb-3">
                  <Icon className="w-4.5 h-4.5 text-gray-700" />
                </div>
                <h3 className="font-bold text-gray-900 mb-1.5 text-sm">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white border-t border-b border-gray-100 py-14">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-2 text-gray-900">使用流程</h2>
          <p className="text-center text-gray-500 text-sm mb-10">五步完成从简历到投递</p>
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {STEPS.map((item, i) => (
              <div key={item.step} className="flex-1 text-center relative">
                <div className="w-10 h-10 rounded-full bg-gray-900 text-white font-bold text-sm flex items-center justify-center mx-auto mb-3">
                  {item.step}
                </div>
                <h3 className="font-bold text-gray-900 mb-1 text-sm">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                {i < 4 && (
                  <div className="hidden sm:block absolute top-5 -right-3 text-gray-300">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 text-gray-400 py-8 text-center text-sm border-t border-gray-100">
        <p className="font-medium text-gray-600">Offer 捕手</p>
        <p className="mt-1">AI 求职智能匹配系统 · 开源求职助手</p>
      </footer>
    </div>
  )
}
