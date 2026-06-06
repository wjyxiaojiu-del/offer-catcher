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
  options?: { silent?: boolean; abortController?: AbortController }
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // If an AbortController was provided, abort it so the underlying
      // operation (e.g. an LLM call that accepts a signal) can stop
      // immediately instead of running to completion in the background.
      options?.abortController?.abort()
      reject(new Error(`Timeout after ${ms}ms`))
    }, ms)
  })

  return Promise.race([promise, timeoutPromise])
    .catch((err) => {
      if (!options?.silent) {
        console.warn("withTimeout fallback triggered:", err.message)
      }
      return fallback
    })
    .finally(() => {
      // Always clear the pending timer so it doesn't dangle when the
      // wrapped promise wins the race.
      if (timer) clearTimeout(timer)
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
