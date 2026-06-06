"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/toast"
import type { ParsedResume, Education, Experience, Project } from "@/types"

const emptyEducation = (): Education => ({
  school: "",
  major: "",
  degree: "",
  year: "",
})

const emptyExperience = (): Experience => ({
  company: "",
  title: "",
  duration: "",
  description: "",
})

const emptyProject = (): Project => ({
  name: "",
  description: "",
  techStack: [],
})

const emptyResume: ParsedResume = {
  name: "",
  email: "",
  phone: "",
  education: [],
  experience: [],
  skills: [],
  projects: [],
  rawText: "",
  summary: "",
}

export default function ResumeEditPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [resume, setResume] = useState<ParsedResume>(emptyResume)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [skillInput, setSkillInput] = useState("")

  useEffect(() => {
    const load = async () => {
      const resumeId = sessionStorage.getItem("resumeId")
      const resumeText = sessionStorage.getItem("resumeText")

      if (resumeId) {
        try {
          const res = await fetch(`/api/resume?id=${resumeId}`)
          const data = await res.json()
          if (data.resume) {
            setResume(data.resume)
            setLoading(false)
            return
          }
        } catch (e) {
          console.warn("Load resume by id failed:", e)
        }
      }

      if (resumeText) {
        try {
          const res = await fetch("/api/resume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: resumeText }),
          })
          const data = await res.json()
          if (data.resume) {
            setResume(data.resume)
            if (data.resumeId) sessionStorage.setItem("resumeId", data.resumeId)
          }
        } catch (e) {
          console.warn("Parse resume text failed:", e)
        }
      }

      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const resumeId = sessionStorage.getItem("resumeId")
    try {
      const res = await fetch("/api/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resumeId || undefined, resume }),
      })
      const data = await res.json()
      if (data.id) {
        sessionStorage.setItem("resumeId", data.id)
        sessionStorage.setItem("resumeText", resume.rawText)
      }
      toast("保存成功", "success")
    } catch {
      toast("保存失败，请重试", "error")
    } finally {
      setSaving(false)
    }
  }

  const updateField = <K extends keyof ParsedResume>(
    field: K,
    value: ParsedResume[K]
  ) => {
    setResume((prev) => ({ ...prev, [field]: value }))
  }

  // Education helpers
  const addEducation = () =>
    setResume((prev) => ({
      ...prev,
      education: [...prev.education, emptyEducation()],
    }))

  const updateEducation = (
    idx: number,
    field: keyof Education,
    value: string
  ) => {
    setResume((prev) => {
      const arr = [...prev.education]
      arr[idx] = { ...arr[idx], [field]: value }
      return { ...prev, education: arr }
    })
  }

  const removeEducation = (idx: number) =>
    setResume((prev) => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== idx),
    }))

  // Experience helpers
  const addExperience = () =>
    setResume((prev) => ({
      ...prev,
      experience: [...prev.experience, emptyExperience()],
    }))

  const updateExperience = (
    idx: number,
    field: keyof Experience,
    value: string
  ) => {
    setResume((prev) => {
      const arr = [...prev.experience]
      arr[idx] = { ...arr[idx], [field]: value }
      return { ...prev, experience: arr }
    })
  }

  const removeExperience = (idx: number) =>
    setResume((prev) => ({
      ...prev,
      experience: prev.experience.filter((_, i) => i !== idx),
    }))

  // Project helpers
  const addProject = () =>
    setResume((prev) => ({
      ...prev,
      projects: [...prev.projects, emptyProject()],
    }))

  const updateProject = (idx: number, field: keyof Project, value: string) => {
    setResume((prev) => {
      const arr = [...prev.projects]
      if (field === "techStack") {
        arr[idx] = {
          ...arr[idx],
          techStack: value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
        }
      } else {
        arr[idx] = { ...arr[idx], [field]: value }
      }
      return { ...prev, projects: arr }
    })
  }

  const removeProject = (idx: number) =>
    setResume((prev) => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== idx),
    }))

  // Skills helpers
  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && skillInput.trim()) {
      e.preventDefault()
      const newSkill = skillInput.trim()
      if (!resume.skills.includes(newSkill)) {
        setResume((prev) => ({
          ...prev,
          skills: [...prev.skills, newSkill],
        }))
      }
      setSkillInput("")
    }
  }

  const removeSkill = (skill: string) =>
    setResume((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        加载简历中…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="text-gray-600 hover:text-gray-900 text-sm flex items-center gap-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          返回
        </button>
        <h1 className="font-bold text-gray-900">编辑简历</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "保存中…" : "保存"}
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Basic Info */}
        <section className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-gray-900 text-lg">基本信息</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">姓名</label>
              <input
                value={resume.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="请输入姓名"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">邮箱</label>
              <input
                value={resume.email}
                onChange={(e) => updateField("email", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="example@email.com"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">电话</label>
              <input
                value={resume.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="13800138000"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">个人总结</label>
            <textarea
              value={resume.summary || ""}
              onChange={(e) => updateField("summary", e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              placeholder="简要描述你的核心竞争力…"
            />
          </div>
        </section>

        {/* Education */}
        <section className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-lg">教育经历</h2>
            <button
              onClick={addEducation}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + 添加
            </button>
          </div>
          {resume.education.map((edu, idx) => (
            <div key={idx} className="border rounded-lg p-4 space-y-3 relative group">
              <button
                onClick={() => removeEducation(idx)}
                className="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-colors"
                title="删除"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  placeholder="学校"
                  value={edu.school}
                  onChange={(e) => updateEducation(idx, "school", e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  placeholder="专业"
                  value={edu.major}
                  onChange={(e) => updateEducation(idx, "major", e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  placeholder="学历（本科/硕士等）"
                  value={edu.degree}
                  onChange={(e) => updateEducation(idx, "degree", e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  placeholder="年份（如 2020-2024）"
                  value={edu.year}
                  onChange={(e) => updateEducation(idx, "year", e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          ))}
          {resume.education.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">暂无教育经历，点击上方添加</p>
          )}
        </section>

        {/* Experience */}
        <section className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-lg">工作经历</h2>
            <button
              onClick={addExperience}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + 添加
            </button>
          </div>
          {resume.experience.map((exp, idx) => (
            <div key={idx} className="border rounded-lg p-4 space-y-3 relative group">
              <button
                onClick={() => removeExperience(idx)}
                className="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-colors"
                title="删除"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  placeholder="公司"
                  value={exp.company}
                  onChange={(e) => updateExperience(idx, "company", e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  placeholder="职位"
                  value={exp.title}
                  onChange={(e) => updateExperience(idx, "title", e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  placeholder="时间段（如 2023.06-2024.03）"
                  value={exp.duration}
                  onChange={(e) => updateExperience(idx, "duration", e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <textarea
                placeholder="工作描述"
                value={exp.description}
                onChange={(e) => updateExperience(idx, "description", e.target.value)}
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>
          ))}
          {resume.experience.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">暂无工作经历，点击上方添加</p>
          )}
        </section>

        {/* Projects */}
        <section className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-lg">项目经历</h2>
            <button
              onClick={addProject}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + 添加
            </button>
          </div>
          {resume.projects.map((proj, idx) => (
            <div key={idx} className="border rounded-lg p-4 space-y-3 relative group">
              <button
                onClick={() => removeProject(idx)}
                className="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-colors"
                title="删除"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
              <input
                placeholder="项目名称"
                value={proj.name}
                onChange={(e) => updateProject(idx, "name", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <textarea
                placeholder="项目描述"
                value={proj.description}
                onChange={(e) => updateProject(idx, "description", e.target.value)}
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
              <input
                placeholder="技术栈（逗号分隔）"
                value={proj.techStack.join(", ")}
                onChange={(e) => updateProject(idx, "techStack", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          ))}
          {resume.projects.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">暂无项目经历，点击上方添加</p>
          )}
        </section>

        {/* Skills */}
        <section className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <h2 className="font-bold text-gray-900 text-lg">专业技能</h2>
          <div className="flex flex-wrap gap-2">
            {resume.skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm"
              >
                {skill}
                <button
                  onClick={() => removeSkill(skill)}
                  className="text-blue-400 hover:text-blue-900 ml-0.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </span>
            ))}
          </div>
          <input
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={handleSkillKeyDown}
            placeholder="输入技能名称，按回车添加"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          {resume.skills.length === 0 && (
            <p className="text-sm text-gray-400">暂无技能，在上方输入后按回车添加</p>
          )}
        </section>
      </main>
    </div>
  )
}
