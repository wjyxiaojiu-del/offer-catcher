"use client"

import { useState, useEffect } from "react"

interface DemoStep {
  id: string
  title: string
  description: string
  target?: string
  action?: "click" | "input" | "wait"
  position?: "top" | "bottom" | "center"
  duration?: number
}

const DEMO_STEPS: DemoStep[] = [
  {
    id: "welcome",
    title: "欢迎体验 Offer 捕手",
    description: "这是一个 AI 驱动的求职智能匹配系统。\n接下来将用 3 分钟带您体验完整流程。",
    position: "center"
  },
  {
    id: "upload",
    title: "Step 1: 上传简历",
    description: "支持 PDF / DOCX / TXT 文件上传，也可以直接粘贴文本。\n点击下方按钮自动填入示例简历。",
    target: "demo-sample-btn",
    action: "click"
  },
  {
    id: "match",
    title: "Step 2: AI 智能匹配",
    description: "系统将从技能、学历、经验、关键词四个维度分析简历，\n匹配 25 个热门岗位并生成 AI 分析报告。",
    position: "center",
    duration: 3000
  },
  {
    id: "radar",
    title: "Step 3: 雷达图分析",
    description: "雷达图直观展示简历与岗位的多维度匹配度，\n点击任意岗位卡片可查看详细分析。",
    position: "center"
  },
  {
    id: "auto-apply",
    title: "Step 4: 一键批量投递",
    description: "设置投递策略（匹配度、城市、薪资等），\n系统自动筛选并批量投递，告别重复操作。",
    position: "center"
  },
  {
    id: "done",
    title: "演示完成！",
    description: "以上就是 Offer 捕手的核心功能。\n感谢您的体验，欢迎提出宝贵意见！",
    position: "center"
  }
]

export function DemoGuide() {
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Show the demo button after a short delay
    const timer = setTimeout(() => setIsVisible(true), 1000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!isActive) return

    const step = DEMO_STEPS[currentStep]
    if (!step) {
      setIsActive(false)
      return
    }

    // Auto-advance for steps with duration
    if (step.duration) {
      const timer = setTimeout(() => nextStep(), step.duration)
      return () => clearTimeout(timer)
    }

    // Auto-fill sample resume for the upload step
    if (step.id === "upload") {
      const sampleBtn = document.querySelector('[data-demo="sample-btn"]')
      if (sampleBtn) {
        (sampleBtn as HTMLElement).click()
      }
    }

    // Auto-navigate to match page
    if (step.id === "match") {
      const matchBtn = document.querySelector('[data-demo="match-btn"]')
      if (matchBtn) {
        setTimeout(() => (matchBtn as HTMLElement).click(), 800)
      }
    }
  }, [currentStep, isActive]) // eslint-disable-line react-hooks/exhaustive-deps

  function nextStep() {
    if (currentStep < DEMO_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      setIsActive(false)
      setCurrentStep(0)
    }
  }

  function startDemo() {
    setIsActive(true)
    setCurrentStep(0)
    // Navigate to home if not already there
    if (window.location.pathname !== "/") {
      window.location.href = "/"
    }
  }

  const step = DEMO_STEPS[currentStep]

  if (!isVisible) return null

  return (
    <>
      {/* Floating Demo Button */}
      <button
        onClick={startDemo}
        className={`fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-full font-bold text-sm text-white shadow-2xl transition-all hover:scale-105 active:scale-95 ${
          isActive
            ? "bg-red-500 hover:bg-red-600"
            : "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 animate-bounce"
        }`}
      >
        {isActive ? "✕ 退出演示" : "🎬 演示推荐路径"}
      </button>

      {/* Overlay */}
      {isActive && step && (
        <div className="fixed inset-0 z-[90]">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Card */}
          <div className={`absolute left-1/2 ${step.position === "top" ? "top-24" : step.position === "bottom" ? "bottom-24" : "top-1/2"} -translate-x-1/2 ${step.position !== "top" && step.position !== "bottom" ? "-translate-y-1/2" : ""}`}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md mx-4 animate-fade-in">
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-4">
                {DEMO_STEPS.map((s, i) => (
                  <div key={s.id} className={`h-1.5 rounded-full transition-all ${
                    i === currentStep ? "bg-blue-600 flex-[3]" : i < currentStep ? "bg-blue-300 flex-1" : "bg-gray-200 flex-1"
                  }`} />
                ))}
              </div>

              {/* Content */}
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                  {step.description}
                </p>
              </div>

              {/* Navigation */}
              <div className="flex justify-between items-center">
                <button
                  onClick={() => { setIsActive(false); setCurrentStep(0) }}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  跳过演示
                </button>
                <div className="text-sm text-gray-400 mr-4">
                  {currentStep + 1} / {DEMO_STEPS.length}
                </div>
                <button
                  onClick={nextStep}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all"
                >
                  {currentStep === DEMO_STEPS.length - 1 ? "完成" : "下一步 →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
