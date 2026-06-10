/**
 * Extract a human-readable error message from an API response.
 * Handles both formats:
 *   - { error: "plain string" }
 *   - { error: { message: "...", code: "...", timestamp: "..." } }
 */
export function getApiErrorMessage(data: any, fallback = "操作失败，请重试"): string {
  if (!data) return fallback
  if (typeof data.error === "string") return data.error
  if (typeof data.error?.message === "string") return data.error.message
  if (typeof data.message === "string") return data.message
  return fallback
}

/**
 * Wrap fetch to throw on non-ok status and extract JSON safely.
 */
export async function apiFetch<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = getApiErrorMessage(data, `请求失败 (${res.status})`)
    throw new Error(message)
  }
  return data as T
}
