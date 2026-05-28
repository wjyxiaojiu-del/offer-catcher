import { Job } from "@/data/jobs"
import { ParsedResume } from "./resume-parser"

export interface MatchResult {
  job: Job
  score: number
  skillMatch: number
  educationMatch: number
  experienceMatch: number
  keywordMatch: number
  matchedSkills: string[]
  missingSkills: string[]
  suggestions: string[]
  aiAnalysis: string
  matchLevel: "excellent" | "good" | "fair" | "weak"
  aiPowered?: boolean
}

// Skill synonym groups for fuzzy matching
const SKILL_SYNONYMS: Record<string, string[]> = {
  "react": ["reactjs", "react.js"],
  "vue": ["vuejs", "vue.js", "vue3", "vue2"],
  "angular": ["angularjs"],
  "node": ["nodejs", "node.js"],
  "python": ["py"],
  "javascript": ["js", "es6", "es2015"],
  "typescript": ["ts"],
  "java": ["jdk", "spring"],
  "c++": ["cpp", "c plus plus"],
  "c#": ["csharp", "c sharp"],
  "sql": ["mysql", "postgresql", "sqlite", "oracle"],
  "machine learning": ["ml", "机器学习"],
  "deep learning": ["dl", "深度学习"],
  "natural language processing": ["nlp", "自然语言处理"],
  "computer vision": ["cv", "计算机视觉"],
  "docker": ["容器", "container"],
  "kubernetes": ["k8s"],
  "aws": ["amazon web services"],
  "git": ["github", "gitlab", "版本控制"],
  "figma": ["figma design"],
  "photoshop": ["ps"],
  "数据分析": ["data analysis", "data analytics"],
  "大模型": ["llm", "large language model", "大语言模型"],
  "transformer": ["attention", "self-attention"],
}

export function matchResumeToJobs(resume: ParsedResume, jobs: Job[]): MatchResult[] {
  return jobs.map(job => {
    const skillResult = calculateSkillMatch(resume.skills, job.skills, resume.rawText)
    const educationMatch = calculateEducationMatch(resume.education, job.education)
    const experienceMatch = calculateExperienceMatch(resume.experience, job.experience)
    const keywordMatch = calculateKeywordMatch(resume.rawText, job)

    // Dynamic weighting based on job type
    let weights = { skill: 0.40, edu: 0.20, exp: 0.15, kw: 0.25 }

    // For research/AI jobs, education matters more
    if (job.tags.some(t => ["AI", "算法", "研究", "NLP", "CV"].includes(t))) {
      weights = { skill: 0.35, edu: 0.25, exp: 0.15, kw: 0.25 }
    }
    // For entry-level jobs, skills matter more
    if (job.experience.includes("0-")) {
      weights = { skill: 0.45, edu: 0.20, exp: 0.10, kw: 0.25 }
    }

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

function calculateSkillMatch(resumeSkills: string[], jobSkills: string[], rawText: string): { score: number; matched: string[]; missing: string[] } {
  if (jobSkills.length === 0) return { score: 50, matched: [], missing: [] }

  const normalizedResume = resumeSkills.map(s => s.toLowerCase())
  const lowerText = rawText.toLowerCase()
  const matched: string[] = []
  const missing: string[] = []

  for (const jobSkill of jobSkills) {
    const jobSkillLower = jobSkill.toLowerCase()
    let isMatch = false

    // Direct match
    if (normalizedResume.some(rs => rs.includes(jobSkillLower) || jobSkillLower.includes(rs))) {
      isMatch = true
    }

    // Synonym match
    if (!isMatch) {
      for (const [canonical, synonyms] of Object.entries(SKILL_SYNONYMS)) {
        const allForms = [canonical, ...synonyms]
        const jobMatchesForm = allForms.some(f => f === jobSkillLower || jobSkillLower.includes(f))
        const resumeMatchesForm = normalizedResume.some(rs => allForms.some(f => rs.includes(f) || f.includes(rs)))
        if (jobMatchesForm && resumeMatchesForm) {
          isMatch = true
          break
        }
      }
    }

    // Fuzzy match in raw text
    if (!isMatch && lowerText.includes(jobSkillLower)) {
      isMatch = true
    }

    // Levenshtein for typo tolerance
    if (!isMatch) {
      isMatch = normalizedResume.some(rs => levenshteinDistance(rs, jobSkillLower) <= 2 && jobSkillLower.length > 3)
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

function calculateEducationMatch(educations: any[], jobEducation: string): number {
  if (educations.length === 0) return 30

  const degree = educations[0]?.degree || ""
  const eduLevel: Record<string, number> = { "博士": 5, "硕士": 4, "研究生": 4, "本科": 3, "学士": 3, "专科": 2, "大专": 2 }
  const jobLevel: Record<string, number> = { "硕士及以上": 4, "本科及以上": 3, "博士": 5, "大专及以上": 2, "不限": 0 }

  const userLevel = eduLevel[degree] || 3

  let reqLevel = 3
  for (const [key, val] of Object.entries(jobLevel)) {
    if (jobEducation.includes(key)) { reqLevel = val; break }
  }

  if (reqLevel === 0) return 80
  if (userLevel >= reqLevel) return 95
  if (userLevel === reqLevel - 1) return 55
  if (userLevel === reqLevel - 2) return 25
  return 15
}

function calculateExperienceMatch(experiences: any[], jobExperience: string): number {
  const yearMatch = jobExperience.match(/(\d+)/)
  const requiredYears = yearMatch ? parseInt(yearMatch[1]) : 0

  if (requiredYears === 0) return 85

  const userYears = experiences.length * 1.5
  if (userYears >= requiredYears * 1.5) return 95
  if (userYears >= requiredYears) return 85
  if (userYears >= requiredYears * 0.5) return 60
  if (userYears > 0) return 40
  return 20
}

function calculateKeywordMatch(text: string, job: Job): number {
  const lowerText = text.toLowerCase()

  // Extract meaningful keywords from job
  const jobKeywords = [
    ...job.skills,
    ...job.requirements.flatMap(r => r.split(/[，,、\s]+/).filter(w => w.length > 1)),
    ...job.description.split(/[，,、\s]+/).filter(w => w.length > 1)
  ]

  // Deduplicate
  const uniqueKeywords = Array.from(new Set(jobKeywords.map(k => k.toLowerCase())))

  let matches = 0
  for (const kw of uniqueKeywords) {
    if (lowerText.includes(kw)) matches++
  }

  return Math.min(Math.round((matches / Math.max(uniqueKeywords.length, 1)) * 100), 100)
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
      score: Math.min(resume.projects.length * 30, 100),
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
