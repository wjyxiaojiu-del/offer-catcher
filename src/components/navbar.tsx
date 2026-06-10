"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Target, Bot, Briefcase, Rocket, FileText, Inbox, GraduationCap } from "lucide-react"
import { cn } from "@/lib/utils"

export const NAV_ITEMS = [
  { href: "/", label: "首页", icon: Target },
  { href: "/agent", label: "求职 Agent", icon: Bot },
  { href: "/match", label: "岗位匹配", icon: Briefcase },
  { href: "/interview", label: "面试刷题", icon: GraduationCap },
  { href: "/jd-optimize", label: "JD 优化", icon: FileText },
  { href: "/auto-apply", label: "批量投递", icon: Rocket },
  { href: "/boss", label: "BOSS 直聘", icon: Briefcase },
  { href: "/applications", label: "投递记录", icon: Inbox },
]

// Core items surfaced in the mobile bottom bar (kept to 5 to avoid crowding).
const MOBILE_NAV_ITEMS = [
  { href: "/", label: "首页", icon: Target },
  { href: "/agent", label: "Agent", icon: Bot },
  { href: "/match", label: "匹配", icon: Briefcase },
  { href: "/interview", label: "刷题", icon: GraduationCap },
  { href: "/applications", label: "记录", icon: Inbox },
]

function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
}

export function NavBar() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            <span className="text-lg font-bold text-gray-900">
              Offer 捕手
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = isActivePath(pathname, item.href)
              const Icon = item.icon
              return (
                <Link
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
                </Link>
              )
            })}
          </div>

          {/* Mobile: show only the active page name (full nav lives in BottomNav) */}
          <div className="md:hidden flex items-center gap-2">
            {NAV_ITEMS.filter((i) => isActivePath(pathname, i.href)).map((item) => {
              const Icon = item.icon
              return (
                <span key={item.href} className="flex items-center gap-1.5 text-sm font-medium text-blue-700">
                  <Icon className="w-4 h-4" />
                  {item.label}
                </span>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}

// Fixed bottom navigation for mobile — the desktop top bar collapses on
// small screens, so this is the primary way mobile users move between pages.
export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/90 backdrop-blur-md border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around h-14">
        {MOBILE_NAV_ITEMS.map((item) => {
          const isActive = isActivePath(pathname, item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                isActive ? "text-blue-700" : "text-gray-500 hover:text-gray-800"
              )}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
