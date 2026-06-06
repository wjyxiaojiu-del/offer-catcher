"use client"

import { useState, useEffect } from "react"
import {
  Send, Eye, Phone, XCircle, Sparkles, Inbox, Bot,
  BarChart3, MousePointer, X, ChevronDown,
} from "lucide-react"
import { CountUp } from "@/components/count-up"
import { ApplicationSkeleton } from "@/components/skeleton"
import { migrateLocalStorageToDb } from "@/lib/migration"
import { cn } from "@/lib/utils"
import type { Application, ApplicationStatus } from "@/types"

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Send }> = {
  "已投递": { label: "已投递", color: "text-blue-700", bg: "bg-blue-100", icon: Send },
  "已查看": { label: "HR 已查看", color: "text-yellow-700", bg: "bg-yellow-100", icon: Eye },
  "面试邀请": { label: "面试邀请", color: "text-green-700", bg: "bg-green-100", icon: Phone },
  "已拒绝": { label: "未通过", color: "text-red-700", bg: "bg-red-100", icon: XCircle },
  "已录用": { label: "已录用", color: "text-emerald-700", bg: "bg-emerald-100", icon: Sparkles },
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [filter, setFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    migrateLocalStorageToDb().catch(() => {})
    fetch("/api/apply")
      .then(r => r.json())
      .then(data => {
        if (data.applications?.length > 0) {
          setApplications(data.applications)
          localStorage.setItem("applications", JSON.stringify(data.applications))
        } else {
          const stored = localStorage.getItem("applications")
          if (stored) setApplications(JSON.parse(stored))
        }
        setLoading(false)
      })
      .catch(() => {
        const stored = localStorage.getItem("applications")
        if (stored) setApplications(JSON.parse(stored))
        setLoading(false)
      })
  }, [])

  const updateStatus = (id: string, newStatus: string) => {
    const updated = applications.map(a => a.id === id ? { ...a, status: newStatus as ApplicationStatus } : a)
    setApplications(updated)
    localStorage.setItem("applications", JSON.stringify(updated))
  }

  const deleteApp = (id: string) => {
    const updated = applications.filter(a => a.id !== id)
    setApplications(updated)
    localStorage.setItem("applications", JSON.stringify(updated))
  }

  const clearAll = () => {
    if (confirm("确定清空所有投递记录？")) {
      localStorage.removeItem("applications")
      setApplications([])
    }
  }

  const isAuto = (m: string) => m === "自动投递" || m === "BOSS自动投递"
  const filteredApps = applications.filter(a => {
    if (filter !== "all" && a.status !== filter) return false
    if (methodFilter === "auto" && !isAuto(a.method)) return false
    if (methodFilter === "manual" && isAuto(a.method)) return false
    return true
  })

  const autoCount = applications.filter(a => isAuto(a.method)).length
  const manualCount = applications.length - autoCount

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6 space-y-2">
          <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {[0,1,2,3,4].map(i => <div key={i} className="bg-white rounded-xl border p-3 h-20 animate-pulse" />)}
        </div>
        <div className="space-y-3">
          {[0,1,2,3].map(i => <ApplicationSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 animate-slide-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-gray-400" />
            投递记录
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            共 {applications.length} 条记录
            {autoCount > 0 && <span className="ml-2 text-gray-400">（自动 {autoCount} · 手动 {manualCount}）</span>}
          </p>
        </div>
        {applications.length > 0 && (
          <button onClick={clearAll} className="text-sm text-red-500 hover:text-red-700 transition-colors">
            清空记录
          </button>
        )}
      </div>

      {/* Stats */}
      {applications.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {Object.entries(STATUS_CONFIG).map(([status, config]) => {
            const count = applications.filter(a => a.status === status).length
            const Icon = config.icon
            return (
              <button key={status} onClick={() => setFilter(filter === status ? "all" : status)}
                className={cn(
                  "bg-white rounded-xl border p-3 text-center transition-all hover:shadow-sm active:scale-95",
                  filter === status ? "ring-2 ring-blue-500 shadow-md" : "border-gray-100"
                )}>
                <Icon className={cn("w-5 h-5 mx-auto mb-1", config.color)} />
                <div className="text-xl font-bold text-gray-900"><CountUp end={count} duration={600} /></div>
                <div className="text-xs text-gray-500 mt-0.5">{config.label}</div>
              </button>
            )
          })}
        </div>
      )}

      {/* Method Filter */}
      {applications.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            { key: "all", label: "全部", count: applications.length },
            { key: "manual", label: "手动投递", count: manualCount },
            { key: "auto", label: "自动投递", count: autoCount },
          ].map(({ key, label, count }) => (
            <button key={key} onClick={() => setMethodFilter(key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1",
                methodFilter === key ? "bg-gray-900 text-white" : "bg-white border border-gray-100 text-gray-600 hover:bg-gray-50"
              )}>
              {key === "manual" && <MousePointer className="w-3 h-3" />}
              {key === "auto" && <Bot className="w-3 h-3" />}
              {label} ({count})
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {filteredApps.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Inbox className="w-14 h-14 mx-auto mb-4 text-gray-300" />
          <p className="text-lg">{applications.length === 0 ? "暂无投递记录" : "没有符合条件的记录"}</p>
          <a href="/" className="text-blue-600 text-sm mt-2 inline-block hover:underline">去投递简历 →</a>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredApps.map((app) => {
            const config = STATUS_CONFIG[app.status] || STATUS_CONFIG["已投递"]
            const StatusIcon = config.icon
            return (
              <div key={app.id} className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", config.bg)}>
                      <StatusIcon className={cn("w-4 h-4", config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-900 truncate">{app.jobSnapshot?.title || "未知岗位"}</h3>
                        {app.method === "自动投递" && (
                          <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs font-medium flex-shrink-0">自动</span>
                        )}
                        {app.method === "BOSS自动投递" && (
                          <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium flex-shrink-0">BOSS</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5 truncate">
                        {app.jobSnapshot?.company}
                        {app.jobSnapshot?.location && ` · ${app.jobSnapshot.location}`}
                        {app.jobSnapshot?.salary && ` · ${app.jobSnapshot.salary}`}
                        {app.score && ` · 匹配度 ${app.score}%`}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(app.appliedAt).toLocaleString("zh-CN")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="relative">
                      <select value={app.status} onChange={(e) => updateStatus(app.id, e.target.value)}
                        className={cn("appearance-none pl-2 pr-6 py-1 rounded-lg text-xs font-medium border-0 cursor-pointer", config.bg, config.color)}>
                        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
                          <option key={status} value={status}>{cfg.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                    </div>
                    <button onClick={() => deleteApp(app.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pipeline View */}
      {applications.length > 0 && (
        <div className="mt-8 bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-400" />
            投递漏斗
          </h2>
          <div className="flex items-end gap-3 h-32">
            {Object.entries(STATUS_CONFIG).map(([status, config]) => {
              const count = applications.filter(a => a.status === status).length
              const pct = applications.length > 0 ? (count / applications.length) * 100 : 0
              const Icon = config.icon
              return (
                <div key={status} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-sm font-bold text-gray-900"><CountUp end={count} duration={800} /></span>
                  <div className="w-full bg-gray-100 rounded-t-lg relative overflow-hidden" style={{ height: `${Math.max(pct, 8)}%` }}>
                    <div className={cn("absolute inset-0 opacity-70 rounded-t-lg", config.bg)} />
                  </div>
                  <Icon className={cn("w-4 h-4", config.color)} />
                  <span className="text-xs text-gray-500">{config.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
