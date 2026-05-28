"use client"

import { useState, useEffect, useRef } from "react"

interface CountUpProps {
  end: number
  duration?: number
  suffix?: string
  prefix?: string
  className?: string
  decimals?: number
}

export function CountUp({ end, duration = 1200, suffix = "", prefix = "", className = "", decimals = 0 }: CountUpProps) {
  const [value, setValue] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (hasAnimated.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          animateValue(0, end, duration)
        }
      },
      { threshold: 0.3 }
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [end, duration])

  function animateValue(start: number, target: number, dur: number) {
    const startTime = performance.now()
    const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t))

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / dur, 1)
      const eased = easeOutExpo(progress)
      const current = start + (target - start) * eased

      setValue(current)

      if (progress < 1) {
        requestAnimationFrame(tick)
      }
    }

    requestAnimationFrame(tick)
  }

  return (
    <span ref={ref} className={className}>
      {prefix}{value.toFixed(decimals)}{suffix}
    </span>
  )
}
