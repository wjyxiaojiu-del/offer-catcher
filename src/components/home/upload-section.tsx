"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/toast"

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

export function UploadSection() {
  const [resumeText, setResumeText] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [resumeId, setResumeId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { toast } = useToast()

  const handleFileUpload = useCallback(async (file: File) => {
    const validTypes = [".txt", ".pdf", ".docx", ".doc"]
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()
    if (!validTypes.includes(ext)) { toast("请上传 TXT / PDF / DOCX 格式的文件", "error"); return }

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
        if (data.resume) {
          setResumeText(data.resume.rawText)
          if (data.resumeId) {
            setResumeId(data.resumeId)
          }
        }
        else toast(data.error || "文件解析失败", "error")
      } catch { toast("文件上传失败，请重试", "error") }
      setIsProcessing(false)
    }
  }, [toast])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }, [handleFileUpload])

  const handleSubmit = async (targetPath: string) => {
    if (!resumeText.trim()) return
    let id = resumeId
    if (!id) {
      setIsProcessing(true)
      try {
        const res = await fetch("/api/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: resumeText }),
        })
        const data = await res.json()
        id = data.resumeId ?? null
      } catch {
        toast("简历解析失败，请重试", "error")
      }
      setIsProcessing(false)
    }
    if (!id) {
      toast("请先上传简历或粘贴简历内容", "error")
      return
    }
    router.push(`${targetPath}?resumeId=${id}`)
  }

  const handleSampleClick = () => {
    setResumeText(SAMPLE_RESUME)
    setUploadedFile("示例简历.txt")
    setResumeId(null)
  }

  return (
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
        onChange={(e) => { setResumeText(e.target.value); setResumeId(null) }}
      />

      <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
        <button data-demo="sample-btn"
          className="text-sm text-blue-600 hover:text-blue-800 underline underline-offset-2"
          onClick={handleSampleClick}>
          使用示例简历体验
        </button>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            className={`flex-1 sm:flex-none px-4 py-3 rounded-xl font-medium text-sm transition-all border-2
              ${resumeText.trim()
                ? "border-purple-500 text-purple-600 hover:bg-purple-50 active:scale-[0.98]"
                : "border-gray-300 text-gray-400 cursor-not-allowed"}`}
            onClick={() => handleSubmit("/jd-optimize")}
            disabled={!resumeText.trim()}>
            🎯 针对 JD 优化
          </button>
          <button data-demo="match-btn"
            className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-medium text-white transition-all
              ${resumeText.trim()
                ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                : "bg-gray-300 cursor-not-allowed"}`}
            onClick={() => handleSubmit("/match")}
            disabled={!resumeText.trim()}>
            🚀 智能匹配
          </button>
          <button
            className={`flex-1 sm:flex-none px-4 py-3 rounded-xl font-medium text-sm transition-all border-2
              ${resumeText.trim()
                ? "border-green-500 text-green-600 hover:bg-green-50 active:scale-[0.98]"
                : "border-gray-300 text-gray-400 cursor-not-allowed"}`}
            onClick={() => handleSubmit("/boss")}
            disabled={!resumeText.trim()}>
            🤖 BOSS 直聘
          </button>
        </div>
      </div>
    </div>
  )
}
