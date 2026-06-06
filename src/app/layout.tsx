import type { Metadata } from 'next'
import './globals.css'
import { ErrorBoundary } from '@/components/error-boundary'
import { NavBar } from '@/components/navbar'
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
            <main>{children}</main>
          </ErrorBoundary>
          <DemoGuide />
        </ToastProvider>
      </body>
    </html>
  )
}
