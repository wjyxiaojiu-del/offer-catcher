import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Utility helpers

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
  options?: { silent?: boolean }
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
  )

  return Promise.race([promise, timeoutPromise]).catch((err) => {
    if (!options?.silent) {
      console.warn("withTimeout fallback triggered:", err.message)
    }
    return fallback
  })
}

export function sanitizeText(text: string): string {
  // Remove excessive whitespace and control chars
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
