import type { Metadata } from 'next'
import './globals.css'
import { ErrorBoundary } from '@/components/error-boundary'
import { NavBar, BottomNav } from '@/components/navbar'
import { ToastProvider } from '@/components/ui/toast'
import { DemoGuide } from '@/components/demo-guide'

export const metadata: Metadata = {
  title: 'Offer 捕手 - AI 求职智能匹配',
  description: 'AI 驱动的智能求职匹配系统，帮你找到最合适的岗位',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50">
        <ToastProvider>
          <NavBar />
          <ErrorBoundary>
            {/* pb-16 keeps content clear of the fixed mobile bottom nav */}
            <main className="pb-16 md:pb-0">{children}</main>
          </ErrorBoundary>
          <BottomNav />
          <DemoGuide />
        </ToastProvider>
      </body>
    </html>
  )
}
