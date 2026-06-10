// ============ Resume Types ============

export interface Education {
  school: string
  major: string
  degree: string
  year: string
  startYear?: string
  endYear?: string
  gpa?: string
}

export interface Experience {
  company: string
  title: string
  duration: string
  description: string
  startDate?: string
  endDate?: string
}

export interface Project {
  name: string
  description: string
  techStack: string[]
  url?: string
}

export type ResumeSource = "ai" | "rule"

export interface SkillGrade {
  skill: string
  /** core = 技能区明确列出, project = 项目 techStack 中出现, general = 正文提到 */
  grade: "core" | "project" | "general"
}

export interface ParsedResume {
  name: string
  email: string
  phone: string
  education: Education[]
  experience: Experience[]
  skills: string[]
  skillGrades?: SkillGrade[]
  projects: Project[]
  rawText: string
  source?: ResumeSource
  summary?: string
  id?: string
}

// ============ Job Types ============

export interface Job {
  id: string
  title: string
  company: string
  location: string
  salary: string
  experience: string
  education: string
  description: string
  requirements: string[]
  skills: string[]
  requiredSkills: string[]
  niceToHaveSkills: string[]
  tags: string[]
  postedAt: string
  applyUrl: string
  companySize?: string
  industry?: string
  benefits?: string[]
}

// ============ Match Types ============

export type MatchLevel = "excellent" | "good" | "fair" | "weak"

export interface SkillMatchResult {
  score: number
  matched: string[]
  missing: string[]
}

export interface MatchResult {
  job: Job
  score: number
  skillMatch: number
  educationMatch: number
  experienceMatch: number
  requiredSkillCoverage: number
  matchedSkills: string[]
  missingSkills: string[]
  suggestions: string[]
  aiAnalysis: string
  matchLevel: MatchLevel
  aiPowered?: boolean
}

export interface ReportSection {
  title: string
  score: number
  feedback: string
  improvements: string[]
  icon: string
}

export interface OptimizationReport {
  overall: string
  overallScore: number
  sections: ReportSection[]
}

// ============ Application Types ============

export type ApplicationStatus = "已投递" | "已查看" | "面试邀请" | "已拒绝" | "已录用"
export type ApplicationMethod = "手动投递" | "自动投递" | "BOSS自动投递"

export interface Application {
  id: string
  jobId: string
  jobSnapshot?: {
    title: string
    company: string
    location?: string
    salary?: string
  }
  score?: number
  status: ApplicationStatus
  appliedAt: string
  method: ApplicationMethod
  resumeId?: string
}

// ============ API Types ============

export interface AutoApplyConfig {
  minScore: number
  maxApplications: number
  locations: string[]
  salaryMin: number
  excludeCompanies: string[]
  jobTypes: string[]
}

export interface AutoApplyResult {
  success: boolean
  totalMatched: number
  totalQualified: number
  totalApplied: number
  applications: Application[]
  skippedJobs: { title: string; company: string; score: number; reason: string }[]
}

// ============ BOSS Types ============

export interface BossJob {
  title: string
  company: string
  salary: string
  location: string
  experience: string
  education: string
  description: string
  url: string
  hrName: string
  status: "pending" | "sent" | "skipped" | "error"
  message?: string
}

export interface ApplyConfig {
  keywords: string
  city: string
  maxApply: number
  greeting: string
  minSalary?: number
  experience?: string
  selectedJobs?: BossJob[]
  delayMin?: number
  delayMax?: number
}
