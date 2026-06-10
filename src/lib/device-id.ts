/**
 * Anonymous device identification for lightweight user isolation.
 * Generates a random UUID per browser and stores it in localStorage.
 */

const DEVICE_ID_KEY = "offer-catcher-device-id"

export function getDeviceId(): string {
  if (typeof window === "undefined") return ""
  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

export function clearDeviceId(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(DEVICE_ID_KEY)
  }
}

/**
 * Wrapper around fetch that automatically injects the x-device-id header.
 */
export async function fetchWithDeviceId(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const deviceId = getDeviceId()
  const headers = new Headers(init?.headers)
  if (deviceId) {
    headers.set("x-device-id", deviceId)
  }
  return fetch(input, {
    ...init,
    headers,
  })
}
