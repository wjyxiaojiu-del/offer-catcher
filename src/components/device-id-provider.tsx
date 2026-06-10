"use client"

import { useEffect } from "react"
import { getDeviceId } from "@/lib/device-id"

/**
 * Injects x-device-id header into all fetch requests for lightweight user isolation.
 * Mount once in the root layout.
 */
export function DeviceIdProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const deviceId = getDeviceId()
    if (!deviceId) return

    const originalFetch = window.fetch
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
      const headers = new Headers(init?.headers)
      if (!headers.has("x-device-id")) {
        headers.set("x-device-id", deviceId)
      }
      return originalFetch(input, { ...init, headers })
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  return <>{children}</>
}
