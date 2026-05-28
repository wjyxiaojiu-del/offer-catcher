import type { Metadata } from 'next'
import './globals.css'
import { DemoGuide } from '@/components/demo-guide'

export const metadata: Metadata = {
  title: 'Offer 捕手 - AI 求职智能匹配',
  description: 'AI 驱动的智能求职匹配系统，帮你找到最合适的岗位',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-14">
              <a href="/" className="flex items-center gap-2">
                <span className="text-xl">🎯</span>
                <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Offer 捕手
                </span>
              </a>
              <div className="flex items-center gap-1 sm:gap-4">
                <a href="/" className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  首页
                </a>
                <a href="/match" className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  岗位匹配
                </a>
                <a href="/jd-optimize" className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  JD 优化
                </a>
                <a href="/auto-apply" className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors">
                  🚀 批量投递
                </a>
                <a href="/boss" className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors">
                  🤖 BOSS直聘
                </a>
                <a href="/applications" className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  投递记录
                </a>
              </div>
            </div>
          </div>
        </nav>
        <main>{children}</main>
        <DemoGuide />
      </body>
    </html>
  )
}
