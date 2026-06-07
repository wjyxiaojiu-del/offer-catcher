import type { Job } from "@/types"
import type { ParsedResume, MatchResult } from "@/types"
import { getUniversityBonus } from "@/data/universities"

// Skill synonym groups for fuzzy matching
const SKILL_SYNONYMS: Record<string, string[]> = {
  // Frontend
  "react": ["reactjs", "react.js", "react hooks"],
  "vue": ["vuejs", "vue.js", "vue3", "vue2", "nuxt"],
  "angular": ["angularjs", "angular2"],
  "next.js": ["nextjs", "next"],
  "svelte": ["sveltekit"],
  "redux": ["状态管理", "zustand", "pinia", "mobx"],
  "webpack": ["vite", "打包工具", "bundler", "rollup", "esbuild", "turbopack"],
  "tailwind": ["tailwindcss", "css框架", "unoCSS"],
  "jest": ["vitest", "测试框架", "testing library", "playwright test", "cypress"],
  // Backend
  "node": ["nodejs", "node.js"],
  "express": ["fastify", "koa", "nest", "hapi"],
  "django": ["flask", "fastapi", "python后端"],
  "spring": ["spring boot", "springboot", "java后端"],
  "graphql": ["gql", "apollo"],
  "rest api": ["restful", "api设计"],
  "grpc": ["protobuf"],
  "微服务": ["microservices", "服务治理", "分布式"],
  // Languages
  "python": ["py"],
  "javascript": ["js", "es6", "es2015", "ecmascript"],
  "typescript": ["ts"],
  "java": ["jdk", "jvm"],
  "c++": ["cpp", "c plus plus"],
  "c#": ["csharp", "c sharp", "dotnet", ".net"],
  "go": ["golang"],
  "rust": ["rustlang"],
  "kotlin": ["kt"],
  "swift": ["swiftui"],
  // Database
  "sql": ["mysql", "postgresql", "sqlite", "oracle", "mssql", "mariadb"],
  "mongodb": ["mongo", "nosql", "文档数据库"],
  "redis": ["缓存", "cache", "memcached"],
  "elasticsearch": ["es", "搜索", "elk"],
  "postgres": ["postgresql", "pg", "关系型数据库"],
  "prisma": ["orm", "typeorm", "sequelize", "drizzle"],
  // DevOps
  "docker": ["容器", "container", "容器化"],
  "kubernetes": ["k8s", "容器编排"],
  "aws": ["amazon web services", "云服务", "s3", "ec2", "lambda"],
  "ci/cd": ["持续集成", "持续部署", "github actions", "gitlab ci"],
  "nginx": ["反向代理", "web服务器"],
  "prometheus": ["监控", "grafana", "可观测性", "observability"],
  "terraform": ["iac", "基础设施即代码", "pulumi"],
  "linux": ["shell", "bash", "ubuntu", "centos", "命令行"],
  // AI/ML
  "machine learning": ["ml", "机器学习"],
  "deep learning": ["dl", "深度学习"],
  "natural language processing": ["nlp", "自然语言处理"],
  "computer vision": ["cv", "计算机视觉"],
  "pytorch": ["torch"],
  "tensorflow": ["tf", "keras"],
  "scikit-learn": ["sklearn", "机器学习库"],
  "pandas": ["数据处理", "numpy", "数据分析库"],
  "huggingface": ["transformers库", "预训练模型"],
  "langchain": ["llm应用", "agent框架"],
  "rag": ["检索增强生成", "知识检索"],
  "fine-tuning": ["微调", "lora", "sft", "指令微调"],
  "cuda": ["gpu", "并行计算", "nvidia"],
  // 大模型
  "大模型": ["llm", "large language model", "大语言模型", "gpt", "chatgpt"],
  "transformer": ["attention", "self-attention", "多头注意力"],
  // Mobile
  "flutter": ["dart"],
  "react native": ["rn", "跨平台移动开发"],
  "uniapp": ["跨端开发", "小程序开发"],
  "小程序": ["微信小程序", "miniapp", "支付宝小程序"],
  // Tools
  "git": ["github", "gitlab", "版本控制", "git版本管理"],
  "figma": ["figma design", "设计工具"],
  "photoshop": ["ps", "adobe"],
  // Domain-specific
  "数据分析": ["data analysis", "data analytics", "bi", "商业智能"],
  "agile": ["scrum", "敏捷开发", "kanban", "项目管理"],
  // Chinese skill mappings
  "前端开发": ["frontend", "web前端", "h5"],
  "后端开发": ["backend", "服务端", "server-side"],
  "全栈开发": ["fullstack", "全栈"],
  "自动化测试": ["test automation", "qa", "质量保障", "selenium"],
  "性能优化": ["performance", "profiling", "benchmark"],
}

function normalizeSkill(s: string): string {
  return s.toLowerCase().replace(/[.\-_]/g, "").trim()
}

type Weights = { skill: number; edu: number; exp: number; kw: number }

/**
 * Calculate dynamic weights based on job type.
 * Exported for direct testing.
 */
export function calculateWeights(job: Pick<Job, "experience" | "tags">): Weights {
  // Default weights
  let weights: Weights = { skill: 0.40, edu: 0.20, exp: 0.15, kw: 0.25 }

  // For research/AI jobs, education matters more
  if (job.tags.some(t => ["AI", "算法", "研究", "NLP", "CV"].includes(t))) {
    weights = { skill: 0.35, edu: 0.25, exp: 0.15, kw: 0.25 }
  }

  // For entry-level jobs, skills matter more.
  // Use regex to match "0-N年" pattern at the start, avoiding false positives like "10-15年".
  if (/^0[-~]\d/.test(job.experience.trim())) {
    weights = { skill: 0.45, edu: 0.20, exp: 0.10, kw: 0.25 }
  }

  return weights
}

export function matchResumeToJobs(resume: ParsedResume, jobs: Job[]): MatchResult[] {
  return jobs.map(job => {
    const skillResult = calculateSkillMatch(resume.skills, job.skills, resume.rawText)
    const educationMatch = calculateEducationMatch(resume.education, job.education)
    const experienceMatch = calculateExperienceMatch(resume.experience, job.experience)
    const keywordMatch = calculateKeywordMatch(resume.rawText, job)

    const weights = calculateWeights(job)

    const score = Math.round(
      skillResult.score * weights.skill +
      educationMatch * weights.edu +
      experienceMatch * weights.exp +
      keywordMatch * weights.kw
    )

    const suggestions = generateSuggestions(resume, job, skillResult)
    const aiAnalysis = generateAIAnalysis(resume, job, skillResult, score, educationMatch, experienceMatch)
    const matchLevel: MatchResult["matchLevel"] = score >= 80 ? "excellent" : score >= 60 ? "good" : score >= 40 ? "fair" : "weak"

    return {
      job,
      score: Math.min(score, 100),
      skillMatch: skillResult.score,
      educationMatch,
      experienceMatch,
      keywordMatch,
      matchedSkills: skillResult.matched,
      missingSkills: skillResult.missing,
      suggestions,
      aiAnalysis,
      matchLevel
    }
  }).sort((a, b) => b.score - a.score)
}

function isDirectMatch(resumeSkill: string, jobSkill: string): boolean {
  const normalizedR = normalizeSkill(resumeSkill)
  const normalizedJ = normalizeSkill(jobSkill)

  // Exact equality
  if (normalizedR === normalizedJ) return true

  // Mutual inclusion with length guard — prevents Java ↔ JavaScript contamination
  const longer = Math.max(normalizedR.length, normalizedJ.length)
  const shorter = Math.min(normalizedR.length, normalizedJ.length)
  if (longer - shorter > 2 && longer / shorter > 1.3) return false

  return normalizedR.includes(normalizedJ) || normalizedJ.includes(normalizedR)
}

function isSynonymMatch(jobSkill: string, resumeSkill: string): boolean {
  const jobSkillLower = normalizeSkill(jobSkill)
  const resumeSkillLower = normalizeSkill(resumeSkill)

  for (const [canonical, synonyms] of Object.entries(SKILL_SYNONYMS)) {
    const allForms = [normalizeSkill(canonical), ...synonyms.map(normalizeSkill)]
    const jobMatchesForm = allForms.some(f => f === jobSkillLower)
    const resumeMatchesForm = allForms.some(f => f === resumeSkillLower)
    if (jobMatchesForm && resumeMatchesForm) {
      return true
    }
  }
  return false
}

function calculateSkillMatch(resumeSkills: string[], jobSkills: string[], rawText: string): { score: number; matched: string[]; missing: string[] } {
  if (jobSkills.length === 0) return { score: 50, matched: [], missing: [] }

  const normalizedResume = resumeSkills.map(normalizeSkill)
  const lowerText = rawText.toLowerCase()
  const matched: string[] = []
  const missing: string[] = []

  for (const jobSkill of jobSkills) {
    const jobSkillLower = normalizeSkill(jobSkill)
    let isMatch = false

    // Direct match with length guard
    if (normalizedResume.some(rs => isDirectMatch(rs, jobSkillLower))) {
      isMatch = true
    }

    // Synonym match
    if (!isMatch) {
      if (normalizedResume.some(rs => isSynonymMatch(jobSkill, rs))) {
        isMatch = true
      }
    }

    // Fuzzy match in raw text (word boundary)
    if (!isMatch) {
      const regex = new RegExp(`\\b${escapeRegex(jobSkillLower)}\\b`, "i")
      if (regex.test(lowerText)) {
        isMatch = true
      }
    }

    // Levenshtein for typo tolerance (tightened threshold: 1 for words > 4 chars)
    if (!isMatch) {
      const threshold = jobSkillLower.length > 4 ? 1 : 2
      isMatch = normalizedResume.some(rs => levenshteinDistance(rs, jobSkillLower) <= threshold && jobSkillLower.length > 3)
    }

    if (isMatch) {
      matched.push(jobSkill)
    } else {
      missing.push(jobSkill)
    }
  }

  const score = Math.round((matched.length / jobSkills.length) * 100)
  return { score, matched, missing }
}

function calculateEducationMatch(educations: { degree: string; school?: string }[], jobEducation: string): number {
  if (educations.length === 0) return 30

  const eduLevel: Record<string, number> = { "博士": 5, "硕士": 4, "研究生": 4, "本科": 3, "学士": 3, "专科": 2, "大专": 2 }
  const jobLevel: Record<string, number> = { "硕士及以上": 4, "本科及以上": 3, "博士": 5, "大专及以上": 2, "不限": 0 }

  // Find highest degree across all education entries
  let userLevel = 0
  for (const edu of educations) {
    for (const [key, val] of Object.entries(eduLevel)) {
      if (edu.degree.includes(key)) {
        userLevel = Math.max(userLevel, val)
      }
    }
  }
  if (userLevel === 0) userLevel = 3 // default to bachelor level

  // School tier bonus
  // "双一流"/"985"/"211" etc. as explicit labels in the school name
  const explicitTiers: Record<string, number> = {
    "双一流": 5, "985": 5, "211": 4, "一本": 3, "重点": 3,
  }
  let schoolBonus = 0
  for (const edu of educations) {
    if (!edu.school) continue
    // Check explicit tier labels first
    for (const [key, val] of Object.entries(explicitTiers)) {
      if (edu.school.includes(key)) {
        schoolBonus = Math.max(schoolBonus, val)
      }
    }
    // Then check against 985/211 university name list
    schoolBonus = Math.max(schoolBonus, getUniversityBonus(edu.school))
  }

  let reqLevel = 3
  for (const [key, val] of Object.entries(jobLevel)) {
    if (jobEducation.includes(key)) { reqLevel = val; break }
  }

  if (reqLevel === 0) return 80
  let score: number
  if (userLevel >= reqLevel) score = 95
  else if (userLevel === reqLevel - 1) score = 55
  else if (userLevel === reqLevel - 2) score = 25
  else score = 15

  // Add school bonus (cap at 100)
  if (schoolBonus > 0 && userLevel >= reqLevel) {
    score = Math.min(score + Math.min(schoolBonus, 5), 100)
  }

  return score
}

function parseDateRange(duration: string, startDate?: string, endDate?: string): number {
  // Parse "YYYY.MM-YYYY.MM" or "YYYY-MM-YYYY-MM" format
  const rangeMatch = duration.match(/(\d{4})\s*[.\-年月]\s*(\d{1,2})?\s*[-–至到]\s*(\d{4})\s*[.\-年月]?\s*(\d{1,2})?/)
  if (rangeMatch) {
    const y1 = parseInt(rangeMatch[1])
    const m1 = parseInt(rangeMatch[2] || "7") // default to mid-year
    const y2 = parseInt(rangeMatch[3])
    const m2 = parseInt(rangeMatch[4] || (m1 === 7 ? "7" : m1.toString()))
    if (!isNaN(y1) && !isNaN(y2) && !isNaN(m1) && !isNaN(m2)) {
      return (y2 - y1) * 12 + (m2 - m1)
    }
  }

  // Parse single date fields
  if (startDate && endDate) {
    const sd = startDate.match(/(\d{4})[.\-年月]?\s*(\d{1,2})?/)
    const ed = endDate.match(/(\d{4})[.\-年月]?\s*(\d{1,2})?/)
    if (sd && ed) {
      const y1 = parseInt(sd[1])
      const m1 = parseInt(sd[2] || "7")
      const y2 = parseInt(ed[1])
      const m2 = parseInt(ed[2] || "7")
      if (!isNaN(y1) && !isNaN(y2) && !isNaN(m1) && !isNaN(m2)) {
        return (y2 - y1) * 12 + (m2 - m1)
      }
    }
  }

  // Present marker (e.g., "至今", "present", "now")
  if (startDate && /至今|present|now/i.test(duration)) {
    const sd = startDate.match(/(\d{4})[.\-年月]?\s*(\d{1,2})?/)
    if (sd) {
      const y1 = parseInt(sd[1])
      const m1 = parseInt(sd[2] || "7")
      if (!isNaN(y1) && !isNaN(m1)) {
        const now = new Date()
        const totalMonths = (now.getFullYear() - y1) * 12 + (now.getMonth() + 1 - m1)
        return Math.max(totalMonths, 1)
      }
    }
  }

  // Year-only format: "2022年" or "2022.09"
  const singleDate = duration.match(/(\d{4})[.\-年]/)
  if (singleDate) {
    const year = parseInt(singleDate[1])
    if (!isNaN(year)) {
      const now = new Date()
      return Math.max((now.getFullYear() - year) * 12, 1)
    }
  }

  return 0
}

function calculateExperienceMatch(experiences: { duration: string; startDate?: string; endDate?: string; description?: string }[], jobExperience: string): number {
  const yearMatch = jobExperience.match(/(\d+)/)
  const requiredYears = yearMatch ? parseInt(yearMatch[1]) : 0

  if (requiredYears === 0) return 85

  // Calculate total months from actual date ranges
  let totalMonths = 0
  for (const exp of experiences) {
    const months = parseDateRange(exp.duration, exp.startDate, exp.endDate)
    if (months > 0) {
      totalMonths += months
    }
  }

  // Fallback: if no dates parsable, estimate 6 months per experience entry
  if (totalMonths === 0) {
    totalMonths = experiences.length * 6
  }

  const requiredMonths = requiredYears * 12
  const ratio = totalMonths / Math.max(requiredMonths, 1)

  if (ratio >= 1.5) return 95
  if (ratio >= 1.0) return 85
  if (ratio >= 0.5) return 60
  if (totalMonths > 0) return 40
  return 20
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function calculateKeywordMatch(text: string, job: Job): number {
  const lowerText = text.toLowerCase()

  // Tokenize text into words for word-boundary matching (min length 3 to reduce noise)
  const words = new Set(lowerText.split(/[\s,，、.。;；:：!！?？()（）\[\]{}]+/).filter(w => w.length > 2))

  // Collect keywords from job with tiered weights:
  //   skills/requiredSkills: 3x (core competencies)
  //   requirements: 2x (explicit requirements)
  //   niceToHaveSkills: 1.5x
  //   description: 1x (general context)
  const weightedKeywords: { word: string; weight: number }[] = []

  for (const skill of (job.requiredSkills?.length ? job.requiredSkills : job.skills)) {
    weightedKeywords.push({ word: skill.toLowerCase(), weight: 3 })
  }
  for (const skill of job.niceToHaveSkills ?? []) {
    weightedKeywords.push({ word: skill.toLowerCase(), weight: 1.5 })
  }

  // Extract keywords from requirements (2x weight)
  const reqStopWords = new Set(["优先", "熟悉", "了解", "负责", "具有", "具备", "以上", "经验", "能力", "相关", "良好", "较强", "丰富", "优秀", "熟练", "掌握", "参与", "能够", "优先考虑", "优先", "学历", "本科", "硕士", "博士"])
  const reqWords = job.requirements
    .flatMap(r => r.split(/[，,、\s]+/))
    .map(w => w.toLowerCase().trim())
    .filter(w => w.length > 2 && !reqStopWords.has(w))

  for (const w of reqWords) {
    if (!weightedKeywords.some(k => k.word === w)) {
      weightedKeywords.push({ word: w, weight: 2 })
    }
  }

  // Extract keywords from description (1x weight)
  const descStopWords = new Set([...reqStopWords, "工作", "开发", "技术", "项目", "团队", "公司", "产品", "系统", "平台", "业务", "需求", "方案", "流程", "规范", "文档"])
  const descWords = job.description
    .split(/[，,、\s]+/)
    .map(w => w.toLowerCase().trim())
    .filter(w => w.length > 2 && !descStopWords.has(w))

  for (const w of descWords) {
    if (!weightedKeywords.some(k => k.word === w)) {
      weightedKeywords.push({ word: w, weight: 1 })
    }
  }

  // Deduplicate
  const seen = new Set<string>()
  const unique = weightedKeywords.filter(k => {
    if (seen.has(k.word)) return false
    seen.add(k.word)
    return true
  })

  let totalWeight = 0
  let matchedWeight = 0

  for (const kw of unique) {
    totalWeight += kw.weight
    // Try word boundary match first (most accurate)
    const boundaryRegex = new RegExp(`\\b${escapeRegex(kw.word)}\\b`, "i")
    if (boundaryRegex.test(lowerText)) {
      matchedWeight += kw.weight
      continue
    }
    // Fallback: check if text contains this word as substring (for CJK)
    if (/[一-龥]/.test(kw.word) && lowerText.includes(kw.word)) {
      matchedWeight += kw.weight * 0.7 // partial credit for CJK substring match
      continue
    }
    // Check word-level match in tokenized text
    if (words.has(kw.word)) {
      matchedWeight += kw.weight * 0.8
    }
  }

  return Math.min(Math.round((matchedWeight / Math.max(totalWeight, 1)) * 100), 100)
}

function generateSuggestions(resume: ParsedResume, job: Job, skillResult: { matched: string[]; missing: string[] }): string[] {
  const suggestions: string[] = []

  // Skill gap suggestions
  if (skillResult.missing.length > 0) {
    const topMissing = skillResult.missing.slice(0, 5)
    suggestions.push(`在简历中补充以下关键词可显著提升匹配度: ${topMissing.join("、")}`)
    if (skillResult.missing.length > 5) {
      suggestions.push(`还有 ${skillResult.missing.length - 5} 项技能未覆盖，建议查看完整 JD 对照补充`)
    }
  }

  // Project suggestions
  if (resume.projects.length < 2) {
    suggestions.push("建议增加 1-2 个与岗位相关的项目经历，突出技术栈和量化成果")
  }

  // Experience suggestions
  if (resume.experience.length === 0) {
    if (job.experience.includes("0-")) {
      suggestions.push("该岗位接受应届生，建议补充校内实践、竞赛或社团经历来展示能力")
    } else {
      suggestions.push("建议补充实习或工作经历，即使是校内实践也可以作为经验展示")
    }
  }

  // Quantification suggestions
  if (!resume.rawText.match(/\d+%|\d+万|\d+个|\d+次|提升|增长|优化/)) {
    suggestions.push("建议用量化数据描述成果（如：提升 XX%、处理 XX 万条数据、服务 XX 用户）")
  }

  // Industry-specific suggestions
  if (job.tags.includes("AI") || job.description.includes("大模型")) {
    if (!resume.rawText.match(/AI|大模型|机器学习|深度学习|NLP|CV|LLM/i)) {
      suggestions.push("该岗位涉及 AI/大模型方向，建议突出相关学习经历或项目，即使是自学也可以")
    }
  }

  if (job.tags.includes("大厂")) {
    suggestions.push("大厂简历筛选注重项目亮点和技术深度，建议精简描述、突出核心贡献")
  }

  // Education suggestion
  const eduLevel: Record<string, number> = { "博士": 5, "硕士": 4, "本科": 3, "专科": 2 }
  const jobLevelMap: Record<string, number> = { "硕士及以上": 4, "本科及以上": 3 }
  const userLevel = eduLevel[resume.education[0]?.degree] || 3
  let reqLevel = 3
  for (const [key, val] of Object.entries(jobLevelMap)) {
    if (job.education.includes(key)) { reqLevel = val; break }
  }
  if (userLevel < reqLevel) {
    suggestions.push(`该岗位要求 ${job.education}，当前学历可能不满足硬性要求，建议突出项目经验和技能优势`)
  }

  if (suggestions.length === 0) {
    suggestions.push("简历与岗位匹配度很高！建议针对 JD 微调关键词，投递前再检查一遍格式")
  }

  return suggestions
}

function generateAIAnalysis(
  resume: ParsedResume,
  job: Job,
  skillResult: { matched: string[]; missing: string[] },
  score: number,
  eduScore: number,
  expScore: number
): string {
  const parts: string[] = []

  // Overall assessment
  if (score >= 80) {
    parts.push(`你的简历与「${job.title}」岗位高度匹配（${score}分），建议尽快投递。`)
  } else if (score >= 60) {
    parts.push(`你的简历与「${job.title}」岗位匹配度良好（${score}分），经过针对性优化后投递效果更佳。`)
  } else if (score >= 40) {
    parts.push(`你的简历与「${job.title}」岗位有一定差距（${score}分），需要重点补充相关技能和经历。`)
  } else {
    parts.push(`你的简历与「${job.title}」岗位匹配度较低（${score}分），建议考虑是否需要转方向或大幅补充相关能力。`)
  }

  // Skill analysis
  if (skillResult.matched.length > 0) {
    parts.push(`你已掌握该岗位 ${skillResult.matched.length}/${skillResult.matched.length + skillResult.missing.length} 项核心技能`)
  }

  if (skillResult.missing.length > 0 && skillResult.missing.length <= 3) {
    parts.push(`仅缺少 ${skillResult.missing.join("、")}，短期学习即可补齐。`)
  } else if (skillResult.missing.length > 3) {
    parts.push(`缺少 ${skillResult.missing.length} 项技能，建议优先学习 ${skillResult.missing.slice(0, 3).join("、")}。`)
  }

  // Education analysis
  if (eduScore >= 90) {
    parts.push("学历背景完全满足岗位要求。")
  } else if (eduScore >= 50) {
    parts.push("学历基本满足要求，可通过技能和项目经验弥补。")
  } else {
    parts.push("学历可能是一个门槛，建议重点突出技能和项目经验。")
  }

  // Experience analysis
  if (expScore >= 80) {
    parts.push("经验方面满足岗位需求。")
  } else if (expScore >= 50) {
    parts.push("经验略有不足，但可以通过项目经历来补充说明。")
  } else {
    parts.push("经验方面差距较大，建议先积累相关实习或项目经验。")
  }

  return parts.join("")
}

/**
 * Calculate project relevance score based on tech stack overlap and quantified results.
 * Single project score = base(20) + relevance(0-50) + quantification(0-30)
 * Total = min(sum, 100)
 */
function calculateProjectScore(
  projects: { name: string; description: string; techStack: string[] }[],
  job: Job
): number {
  if (projects.length === 0) return 0

  const jobSkills = new Set(
    [...(job.requiredSkills?.length ? job.requiredSkills : job.skills), ...(job.niceToHaveSkills ?? [])]
      .map(s => normalizeSkill(s))
  )

  let totalScore = 0
  for (const project of projects) {
    // Base score for having a project
    let projectScore = 20

    // Relevance: tech stack overlap with job skills (0-50)
    if (project.techStack.length > 0 && jobSkills.size > 0) {
      const overlap = project.techStack.filter(tech => jobSkills.has(normalizeSkill(tech)))
      const relevanceRatio = overlap.length / Math.max(jobSkills.size, 1)
      projectScore += Math.round(relevanceRatio * 50)
    }

    // Quantification: detect numeric indicators in description (0-30)
    const quantPatterns = /\d+%|\d+万|\d+个|\d+次|\d+人|\d+倍|提升\d|增长\d|优化\d|减少\d|节省\d|服务\d+|[一二三四五六七八九十]+倍/
    if (quantPatterns.test(project.description)) {
      projectScore += 30
    } else if (/\d+/.test(project.description)) {
      // Has numbers but not clear quantification
      projectScore += 10
    }

    totalScore += Math.min(projectScore, 100)
  }

  return Math.min(totalScore, 100)
}

// Generate resume optimization report
export function generateOptimizationReport(resume: ParsedResume, job: Job): {
  overall: string
  overallScore: number
  sections: { title: string; score: number; feedback: string; improvements: string[]; icon: string }[]
} {
  const skillResult = calculateSkillMatch(resume.skills, job.skills, resume.rawText)
  const eduScore = calculateEducationMatch(resume.education, job.education)
  const expScore = calculateExperienceMatch(resume.experience, job.experience)
  const kwScore = calculateKeywordMatch(resume.rawText, job)

  const sections = [
    {
      title: "技能匹配度",
      score: skillResult.score,
      feedback: skillResult.score >= 70 ? "技能覆盖良好，大部分核心技能已掌握" :
                skillResult.score >= 40 ? "技能覆盖一般，有提升空间" : "技能缺口较大，需要重点补充",
      improvements: skillResult.missing.length > 0
        ? [`建议补充: ${skillResult.missing.join("、")}`, "可通过在线课程或项目实践快速学习"]
        : ["技能覆盖充分，保持即可"],
      icon: "🎯"
    },
    {
      title: "教育背景",
      score: eduScore,
      feedback: eduScore >= 80 ? "学历满足岗位要求" :
                eduScore >= 50 ? "学历基本满足，但不是最优" : "学历可能不满足硬性要求",
      improvements: eduScore < 80
        ? ["建议突出学校排名/专业排名", "补充相关课程和成绩"]
        : ["教育背景良好"],
      icon: "🎓"
    },
    {
      title: "工作经验",
      score: expScore,
      feedback: expScore >= 80 ? "经验匹配度高" :
                expScore >= 50 ? "经验略有不足" : "经验差距较大",
      improvements: expScore < 70
        ? ["建议补充实习经历", "用项目经历替代工作经验", "突出校内实践和竞赛"]
        : ["经验匹配良好"],
      icon: "💼"
    },
    {
      title: "项目经历",
      score: calculateProjectScore(resume.projects, job),
      feedback: resume.projects.length >= 3 ? "项目经历充实" :
                resume.projects.length >= 2 ? "项目经历基本够用" : "项目经历偏少",
      improvements: resume.projects.length < 2
        ? ["建议增加 2-3 个与岗位相关的项目", "每个项目突出技术栈和量化成果"]
        : ["建议为每个项目补充量化成果描述"],
      icon: "🚀"
    },
    {
      title: "关键词覆盖",
      score: kwScore,
      feedback: kwScore >= 70 ? "JD 关键词覆盖良好" :
                kwScore >= 40 ? "部分关键词缺失" : "关键词覆盖不足，可能被 ATS 筛掉",
      improvements: kwScore < 70
        ? ["对照 JD 逐条检查关键词覆盖", "用 JD 中的原词替换简历中的同义词"]
        : ["关键词覆盖充分"],
      icon: "🔑"
    },
    {
      title: "简历完整性",
      score: calculateCompleteness(resume),
      feedback: "简历信息完整度评估",
      improvements: getCompletenessSuggestions(resume),
      icon: "📋"
    }
  ]

  const avgScore = Math.round(sections.reduce((s, sec) => s + sec.score, 0) / sections.length)
  const overall = avgScore >= 70
    ? `简历与「${job.title}」匹配度较高（${avgScore}分），建议微调后直接投递。重点优化 ${sections.filter(s => s.score < 70).map(s => s.title).join("、") || "格式和排版"} 即可。`
    : avgScore >= 40
    ? `简历有提升空间（${avgScore}分），建议按下方优化建议修改后再投递。优先补充 ${sections.sort((a, b) => a.score - b.score).slice(0, 2).map(s => s.title).join("和")}。`
    : `简历与岗位差距较大（${avgScore}分），建议重点补充 ${sections.sort((a, b) => a.score - b.score).slice(0, 2).map(s => s.title).join("和")}，或考虑匹配度更高的岗位。`

  return { overall, overallScore: avgScore, sections }
}

function calculateCompleteness(resume: ParsedResume): number {
  let score = 0
  if (resume.name && resume.name !== "未知") score += 15
  if (resume.email || resume.phone) score += 15
  if (resume.education.length > 0) score += 20
  if (resume.experience.length > 0) score += 20
  if (resume.skills.length >= 3) score += 15
  if (resume.projects.length > 0) score += 15
  return score
}

function getCompletenessSuggestions(resume: ParsedResume): string[] {
  const s: string[] = []
  if (!resume.name || resume.name === "未知") s.push("补充姓名信息")
  if (!resume.email && !resume.phone) s.push("补充联系方式（邮箱/电话）")
  if (resume.education.length === 0) s.push("补充教育经历")
  if (resume.experience.length === 0) s.push("补充工作/实习经历")
  if (resume.skills.length < 3) s.push("补充技能列表（至少 3 项核心技能）")
  if (resume.projects.length === 0) s.push("补充项目经历")
  return s.length > 0 ? s : ["简历信息完整，格式良好"]
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}
