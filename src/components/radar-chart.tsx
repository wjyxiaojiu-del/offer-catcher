"use client"

import { useState, useEffect, useRef } from "react"

interface RadarChartProps {
  data: { label: string; value: number; color?: string }[]
  size?: number
  className?: string
}

export function RadarChart({ data, size = 220, className = "" }: RadarChartProps) {
  const [progress, setProgress] = useState(0)
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          animateIn()
        }
      },
      { threshold: 0.3 }
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  function animateIn() {
    const start = performance.now()
    const duration = 1000

    function tick(now: number) {
      const elapsed = now - start
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setProgress(eased)
      if (t < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  }

  const cx = size / 2
  const cy = size / 2
  const maxRadius = size / 2 - 40
  const count = data.length
  const angleStep = (2 * Math.PI) / count

  // Calculate polygon points for a given value (0-100)
  function getPoints(value: number, radius: number) {
    return data.map((_, i) => {
      const angle = i * angleStep - Math.PI / 2
      const r = (value / 100) * radius
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
    }).join(" ")
  }

  // Grid rings
  const rings = [20, 40, 60, 80, 100]

  // Scan line animation
  const scanAngle = progress * 360 * 3 // 3 full rotations

  return (
    <div className={`relative ${className}`}>
      <svg ref={ref} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background grid */}
        {rings.map((ring) => (
          <polygon
            key={ring}
            points={getPoints(ring, maxRadius)}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="0.5"
            opacity="0.6"
          />
        ))}

        {/* Axis lines */}
        {data.map((_, i) => {
          const angle = i * angleStep - Math.PI / 2
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={cx + maxRadius * Math.cos(angle)}
              y2={cy + maxRadius * Math.sin(angle)}
              stroke="#e5e7eb"
              strokeWidth="0.5"
              opacity="0.4"
            />
          )
        })}

        {/* Data polygon - animated */}
        <polygon
          points={data.map((d, i) => {
            const angle = i * angleStep - Math.PI / 2
            const r = ((d.value * progress) / 100) * maxRadius
            return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
          }).join(" ")}
          fill="rgba(59, 130, 246, 0.15)"
          stroke="#3b82f6"
          strokeWidth="2"
          className="transition-all duration-300"
        />

        {/* Data points */}
        {data.map((d, i) => {
          const angle = i * angleStep - Math.PI / 2
          const r = ((d.value * progress) / 100) * maxRadius
          return (
            <circle
              key={i}
              cx={cx + r * Math.cos(angle)}
              cy={cy + r * Math.sin(angle)}
              r={4}
              fill={d.color || "#3b82f6"}
              stroke="white"
              strokeWidth="2"
              className="transition-all duration-300"
            />
          )
        })}

        {/* Scan line */}
        <line
          x1={cx}
          y1={cy}
          x2={cx + maxRadius * Math.cos((scanAngle * Math.PI) / 180 - Math.PI / 2)}
          y2={cy + maxRadius * Math.sin((scanAngle * Math.PI) / 180 - Math.PI / 2)}
          stroke="rgba(59, 130, 246, 0.4)"
          strokeWidth="1.5"
          strokeDasharray="4,4"
        />

        {/* Scan glow */}
        <circle
          cx={cx + maxRadius * 0.6 * Math.cos((scanAngle * Math.PI) / 180 - Math.PI / 2)}
          cy={cy + maxRadius * 0.6 * Math.sin((scanAngle * Math.PI) / 180 - Math.PI / 2)}
          r={8}
          fill="rgba(59, 130, 246, 0.3)"
          className="animate-pulse"
        />
      </svg>

      {/* Labels */}
      {data.map((d, i) => {
        const angle = i * angleStep - Math.PI / 2
        const labelR = maxRadius + 22
        const x = cx + labelR * Math.cos(angle)
        const y = cy + labelR * Math.sin(angle)

        return (
          <div
            key={i}
            className="absolute text-center pointer-events-none"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="text-xs font-medium text-gray-700 whitespace-nowrap">{d.label}</div>
            <div className="text-xs font-bold text-blue-600">{Math.round(d.value * progress)}%</div>
          </div>
        )
      })}
    </div>
  )
}
