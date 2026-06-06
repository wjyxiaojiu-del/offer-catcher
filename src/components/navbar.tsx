"use client"

import { usePathname } from "next/navigation"
import { Target, Bot, Briefcase, Rocket, FileText, Inbox } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/", label: "首页", icon: Target },
  { href: "/agent", label: "求职 Agent", icon: Bot },
  { href: "/match", label: "岗位匹配", icon: Briefcase },
  { href: "/jd-optimize", label: "JD 优化", icon: FileText },
  { href: "/auto-apply", label: "批量投递", icon: Rocket },
  { href: "/boss", label: "BOSS 直聘", icon: Briefcase },
  { href: "/applications", label: "投递记录", icon: Inbox },
]

export function NavBar() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            <span className="text-lg font-bold text-gray-900">
              Offer 捕手
            </span>
          </a>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
              const Icon = item.icon
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                    isActive
                      ? "text-blue-700 bg-blue-50"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </a>
              )
            })}
          </div>

          {/* Mobile: show only active + dropdown hint */}
          <div className="md:hidden flex items-center gap-2">
            {NAV_ITEMS.filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`)).map((item) => {
              const Icon = item.icon
              return (
                <span key={item.href} className="flex items-center gap-1.5 text-sm font-medium text-blue-700">
                  <Icon className="w-4 h-4" />
                  {item.label}
                </span>
              )
            })}
            <span className="text-xs text-gray-400">导航见底部</span>
          </div>
        </div>
      </div>
    </nav>
  )
}
