import type { Metadata } from 'next'
import './globals.css'
import { ErrorBoundary } from '@/components/error-boundary'
import { NavBar, BottomNav } from '@/components/navbar'
import { ToastProvider } from '@/components/ui/toast'
import { DeviceIdProvider } from '@/components/device-id-provider'

export const metadata: Metadata = {
  title: 'Offer 捕手 - AI 求职智能匹配',
  description: 'AI 驱动的智能求职匹配系统，帮你找到最合适的岗位',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🎯</text></svg>',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50">
        <DeviceIdProvider>
          <ToastProvider>
            <NavBar />
            <ErrorBoundary>
              {/* pb-16 keeps content clear of the fixed mobile bottom nav */}
              <main className="pb-16 md:pb-0">{children}</main>
            </ErrorBoundary>
            <BottomNav />
          </ToastProvider>
        </DeviceIdProvider>
      </body>
    </html>
  )
}
