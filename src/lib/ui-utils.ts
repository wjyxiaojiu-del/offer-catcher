// ============================================================
// Tiny UI helpers shared across pages
// ============================================================

// Match-score → Tailwind text color. The 80/60/40 thresholds were inlined
// in 4 places across agent/page (twice), match/page, etc. Centralize so they
// can't drift.
export function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600"
  if (score >= 60) return "text-blue-600"
  if (score >= 40) return "text-yellow-600"
  return "text-red-500"
}

// Match-score → Tailwind background color (for skill progress bars / pills).
export function barColor(score: number): string {
  if (score >= 70) return "bg-green-500"
  if (score >= 40) return "bg-yellow-500"
  return "bg-red-500"
}

// Defensive localStorage wrapper: writes can throw QuotaExceededError
// (long chat histories serialize to multi-MB blobs). Without this, agent
// page crashed the whole page on overflow. Silently drops failed writes.
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function safeGetJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
