import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAllJobs } from '@/lib/job-service'
import { getDeviceIdFromRequest } from '@/lib/api-device'

export async function GET(req: NextRequest) {
  try {
    const deviceId = getDeviceIdFromRequest(req)
    const [jobs, questions, applications] = await Promise.all([
      getAllJobs().then((j) => j.length),
      prisma.interviewQuestion.count(),
      prisma.application.count({ where: { deviceId: deviceId || undefined } }),
    ])
    return NextResponse.json({ jobs, questions, applications })
  } catch (error) {
    console.error('Stats API error:', error)
    // DB 不可用时返回合理的 fallback
    return NextResponse.json({
      jobs: 25,
      questions: 0,
      applications: 0,
    })
  }
}
