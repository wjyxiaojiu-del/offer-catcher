/**
 * 岗位服务 - 从数据库获取岗位数据
 * 支持从多个来源获取岗位：数据库、BOSS 直聘等
 */

import { prisma } from '@/lib/db'
import type { Job } from '@/types'

// 默认的内置岗位数据（作为 fallback）
import { jobs as builtinJobs } from '@/data/jobs'

/**
 * 从数据库获取所有岗位
 */
export async function getJobsFromDB(): Promise<Job[]> {
  try {
    const dbJobs = await prisma.job.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    })

    return dbJobs.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      salary: j.salaryText || `${j.salaryMin || 0}-${j.salaryMax || 0}K`,
      experience: j.experience,
      education: j.education,
      description: j.description,
      requirements: safeParseJSON(j.requirements, []),
      skills: safeParseJSON(j.skills, []),
      requiredSkills: safeParseJSON(j.skills, []),
      niceToHaveSkills: [],
      tags: safeParseJSON(j.tags, []),
      postedAt: j.postedAt?.toISOString() || j.createdAt.toISOString(),
      applyUrl: j.applyUrl || '',
    }))
  } catch (error) {
    console.error('Failed to fetch jobs from DB:', error)
    return []
  }
}

/**
 * 获取所有可用岗位（数据库 + 内置）
 * 数据库岗位优先，内置岗位作为补充
 */
export async function getAllJobs(): Promise<Job[]> {
  const dbJobs = await getJobsFromDB()

  // 如果数据库有岗位，使用数据库的；否则使用内置的
  if (dbJobs.length > 0) {
    return dbJobs
  }

  // 内置岗位作为 fallback
  return builtinJobs
}

/**
 * 保存岗位到数据库
 */
export async function saveJob(job: Partial<Job>): Promise<string> {
  const saved = await prisma.job.upsert({
    where: {
      title_company: {
        title: job.title || '',
        company: job.company || '',
      },
    },
    update: {
      location: job.location || '',
      salaryText: job.salary,
      experience: job.experience || '',
      education: job.education || '',
      description: job.description || '',
      requirements: JSON.stringify(job.requirements || []),
      skills: JSON.stringify(job.requiredSkills || job.skills || []),
      tags: JSON.stringify(job.tags || []),
      applyUrl: job.applyUrl,
      isActive: true,
    },
    create: {
      title: job.title || '',
      company: job.company || '',
      location: job.location || '',
      salaryText: job.salary,
      experience: job.experience || '',
      education: job.education || '',
      description: job.description || '',
      requirements: JSON.stringify(job.requirements || []),
      skills: JSON.stringify(job.requiredSkills || job.skills || []),
      tags: JSON.stringify(job.tags || []),
      applyUrl: job.applyUrl,
      isActive: true,
    },
  })

  return saved.id
}

/**
 * 批量保存岗位
 */
export async function saveJobs(jobs: Partial<Job>[]): Promise<number> {
  let count = 0
  for (const job of jobs) {
    try {
      await saveJob(job)
      count++
    } catch (error) {
      console.error(`Failed to save job ${job.title}:`, error)
    }
  }
  return count
}

/**
 * 搜索岗位（支持关键词搜索）
 */
export async function searchJobs(query: string): Promise<Job[]> {
  const jobs = await getAllJobs()
  const lowerQuery = query.toLowerCase()

  return jobs.filter(
    (j) =>
      j.title.toLowerCase().includes(lowerQuery) ||
      j.company.toLowerCase().includes(lowerQuery) ||
      j.description.toLowerCase().includes(lowerQuery) ||
      j.skills.some((s) => s.toLowerCase().includes(lowerQuery))
  )
}

/**
 * 按标签筛选岗位
 */
export async function getJobsByTags(tags: string[]): Promise<Job[]> {
  const jobs = await getAllJobs()

  return jobs.filter((j) =>
    tags.some(
      (tag) =>
        j.tags.includes(tag) ||
        j.title.includes(tag) ||
        j.description.includes(tag)
    )
  )
}

// Helper function
function safeParseJSON<T>(json: string, fallback: T): T {
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? (parsed as T) : fallback
  } catch {
    return fallback
  }
}
