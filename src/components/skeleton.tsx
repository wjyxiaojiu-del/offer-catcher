"use client"

export function Skeleton({ className = "", rounded = "rounded" }: { className?: string; rounded?: string }) {
  return (
    <div className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] skeleton-shimmer ${rounded} ${className}`} />
  )
}

export function MatchCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border p-5 space-y-3">
      <div className="flex justify-between items-start">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-8 w-14 rounded-lg" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-3 w-8 mx-auto" />
          </div>
        ))}
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-16 rounded-lg" />
      </div>
    </div>
  )
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-5 gap-3">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white rounded-xl border p-3 text-center space-y-2">
          <Skeleton className="h-8 w-10 mx-auto" />
          <Skeleton className="h-3 w-12 mx-auto" />
        </div>
      ))}
    </div>
  )
}

export function ResumeSkeleton() {
  return (
    <div className="bg-white rounded-xl border p-5 space-y-4">
      <Skeleton className="h-5 w-32" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-1">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <Skeleton key={i} className="h-5 w-14 rounded-full" />
        ))}
      </div>
    </div>
  )
}

export function ApplicationSkeleton() {
  return (
    <div className="bg-white rounded-xl border p-4 sm:p-5 space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="h-6 w-16 rounded-lg" />
      </div>
    </div>
  )
}
