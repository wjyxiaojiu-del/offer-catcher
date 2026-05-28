"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { CountUp } from "@/components/count-up"

const SAMPLE_RESUME = `王小明
wangxiaoming@email.com | 13800138000

教育经历
浙江农林大学 园艺学院 设施农业科学与工程 本科 2022-2026
GPA: 3.6/4.0 | 校级优秀学生奖学金

专业技能
Python, JavaScript, TypeScript, React, Vue, SQL, Git, Docker, Linux
数据分析, SPSS, Excel, 论文写作, 田间试验

项目经历
智能温室监控系统
基于 React + Node.js + Arduino 的温室环境监控平台，实现温湿度自动调控
技术栈: React, TypeScript, Node.js, MongoDB
成果: 覆盖 3 个温室大棚，降低人工巡检频率 60%

农产品溯源系统
基于区块链的农产品全流程溯源 DApp
技术栈: Solidity, React, Web3.js, IPFS
成果: 获校级创新创业大赛二等奖

实习经历
某农业科技有限公司 技术部实习生 2025.06-2025.09
参与公司农业信息化平台前端开发，使用 Vue3 + TypeScript
负责数据可视化模块开发，优化页面加载速度 40%
`

export default function Home() {
  const [resumeText, setResumeText] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFileUpload = useCallback(async (file: File) => {
    const validTypes = [".txt", ".pdf", ".docx", ".doc"]
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()
    if (!validTypes.includes(ext)) { alert("请上传 TXT / PDF / DOCX 格式的文件"); return }

    setUploadedFile(file.name)
    setIsProcessing(true)

    if (ext === ".txt") {
      const reader = new FileReader()
      reader.onload = (e) => { setResumeText(e.target?.result as string); setIsProcessing(false) }
      reader.readAsText(file)
    } else {
      const formData = new FormData()
      formData.append("file", file)
      try {
        const res = await fetch("/api/resume", { method: "POST", body: formData })
        const data = await res.json()
        if (data.resume) setResumeText(data.resume.rawText)
        else alert(data.error || "文件解析失败")
      } catch { alert("文件上传失败，请重试") }
      setIsProcessing(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }, [handleFileUpload])

  const handleSubmit = () => {
    if (!resumeText.trim()) return
    sessionStorage.setItem("resumeText", resumeText)
    router.push("/match")
  }

  const handleSampleClick = () => {
    setResumeText(SAMPLE_RESUME)
    setUploadedFile("示例简历.txt")
  }

  return (
    <div className="min-h-[calc(100vh-56px)]">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50" />
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: "radial-gradient(circle at 25% 25%, rgba(59,130,246,0.15) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(168,85,247,0.15) 0%, transparent 50%)"
        }} />
        <div className="relative max-w-7xl mx-auto px-4 py-14 sm:py-20">
          <div className="text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-700 mb-5">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              AI 驱动的智能求职匹配引擎
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Offer 捕手
              </span>
            </h1>
            <p className="mt-4 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
              上传简历，AI 帮你智能匹配最合适的岗位<br className="hidden sm:block" />
              分析简历差距，一键批量投递，告别海投时代
            </p>

            {/* CountUp Stats */}
            <div className="mt-8 flex flex-wrap justify-center gap-6 sm:gap-10">
              {[
                { value: 25, suffix: "+", label: "热门岗位" },
                { value: 95, suffix: "%", label: "匹配精度" },
                { value: 4, suffix: "维", label: "智能分析" },
                { value: 3, suffix: "秒", label: "极速匹配" },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    <CountUp end={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Upload Section */}
      <section className="max-w-3xl mx-auto px-4 -mt-5 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl border p-6 sm:p-8 animate-slide-up">
          <h2 className="text-xl font-bold text-center mb-6">上传简历，开始智能匹配</h2>

          {/* Drag & Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all cursor-pointer
              ${isDragging ? "border-blue-500 bg-blue-50 scale-[1.02]" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"}
              ${isProcessing ? "pointer-events-none opacity-60" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {isProcessing ? (
              <div>
                <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-lg font-medium text-gray-700">正在解析文件...</p>
              </div>
            ) : uploadedFile ? (
              <div>
                <div className="text-4xl mb-3">✅</div>
                <p className="text-lg font-medium text-gray-700">{uploadedFile}</p>
                <p className="text-sm text-gray-500 mt-1">文件已解析，可点击重新上传</p>
              </div>
            ) : (
              <div>
                <div className="text-4xl mb-3">📎</div>
                <p className="text-lg font-medium text-gray-700">拖拽简历文件到此处</p>
                <p className="text-sm text-gray-500 mt-1">支持 PDF / DOCX / TXT 格式</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".txt,.text,.pdf,.docx,.doc" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
          </div>

          <div className="text-center my-4 text-gray-400 text-sm flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span>或直接粘贴简历文本</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <textarea
            className="w-full h-40 border rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
            placeholder="在此粘贴你的简历内容..."
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
          />

          <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
            <button data-demo="sample-btn"
              className="text-sm text-blue-600 hover:text-blue-800 underline underline-offset-2"
              onClick={handleSampleClick}>
              使用示例简历体验
            </button>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                className={`flex-1 sm:flex-none px-5 py-3 rounded-xl font-medium text-sm transition-all border-2
                  ${resumeText.trim()
                    ? "border-purple-500 text-purple-600 hover:bg-purple-50 active:scale-[0.98]"
                    : "border-gray-300 text-gray-400 cursor-not-allowed"}`}
                onClick={() => {
                  if (!resumeText.trim()) return
                  sessionStorage.setItem("resumeText", resumeText)
                  router.push("/jd-optimize")
                }}
                disabled={!resumeText.trim()}>
                🎯 针对 JD 优化
              </button>
              <button data-demo="match-btn"
                className={`flex-1 sm:flex-none px-8 py-3 rounded-xl font-medium text-white transition-all
                  ${resumeText.trim()
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-gray-300 cursor-not-allowed"}`}
                onClick={handleSubmit}
                disabled={!resumeText.trim()}>
                🚀 智能匹配
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 py-14">
        <h2 className="text-2xl font-bold text-center mb-10">核心功能</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: "🎯", title: "智能岗位匹配", desc: "基于多维度算法分析简历与 JD 的匹配度，精准推荐最适合的岗位" },
            { icon: "🤖", title: "AI 分析报告", desc: "生成详细的 AI 分析报告，告诉你为什么匹配、哪里需要提升" },
            { icon: "📊", title: "简历优化建议", desc: "逐项对比简历与岗位要求，给出具体的优化方向和关键词建议" },
            { icon: "🚀", title: "一键批量投递", desc: "设置投递策略后自动筛选并批量投递，告别重复操作" },
          ].map((f, i) => (
            <div key={i} className="bg-white rounded-xl p-5 shadow-sm border hover:shadow-md transition-all hover:-translate-y-0.5 animate-scale-in"
              style={{ animationDelay: `${i * 100}ms` }}>
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-bold mb-2">{f.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white border-t border-b py-14">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-10">使用流程</h2>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {[
              { step: "01", title: "上传简历", desc: "支持 PDF/DOCX/TXT 或直接粘贴文本" },
              { step: "02", title: "AI 分析匹配", desc: "多维度分析简历，匹配 25+ 岗位" },
              { step: "03", title: "查看报告", desc: "查看匹配度、雷达图、AI 分析" },
              { step: "04", title: "一键投递", desc: "选择心仪岗位或批量自动投递" },
            ].map((item, i) => (
              <div key={i} className="flex-1 text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold text-lg flex items-center justify-center mx-auto mb-3 shadow-lg">
                  {item.step}
                </div>
                <h3 className="font-bold mb-1">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
                {i < 3 && <div className="hidden sm:block text-2xl text-gray-300 mt-2">→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 text-center text-sm">
        <p className="font-medium text-gray-300">Offer 捕手</p>
        <p className="mt-1">AI 求职智能匹配系统 · 课程作业 Demo</p>
      </footer>
    </div>
  )
}
