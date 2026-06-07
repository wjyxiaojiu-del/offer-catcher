import type { ParsedResume, Education, Experience, Project } from "@/types"

// Skill dictionary for extraction
const SKILL_DICT = [
  // Programming
  "JavaScript", "TypeScript", "Python", "Java", "Go", "Rust", "C", "C++", "C#", "PHP", "Ruby", "Swift", "Kotlin",
  // Frontend
  "React", "Vue", "Angular", "Next.js", "Nuxt", "Svelte", "HTML", "CSS", "Sass", "Tailwind", "Webpack", "Vite",
  // Backend
  "Node.js", "Express", "Django", "Flask", "Spring", "FastAPI", "Gin", "Koa",
  // Data
  "SQL", "MySQL", "PostgreSQL", "MongoDB", "Redis", "Elasticsearch", "Kafka", "RabbitMQ",
  // AI/ML
  "PyTorch", "TensorFlow", "NLP", "大模型", "Transformer", "机器学习", "深度学习", "计算机视觉", "LLM",
  // DevOps
  "Docker", "Kubernetes", "AWS", "Linux", "Git", "Jenkins", "CI/CD", "Terraform", "Shell",
  // Tools
  "Figma", "Sketch", "Photoshop", "Axure", "Tableau", "SPSS", "Excel", "PPT",
  // Domain
  "数据分析", "需求分析", "产品设计", "用户研究", "活动策划", "内容运营", "用户运营",
  // Agriculture
  "农业", "园艺", "育种", "田间试验", "论文写作",
  // Embedded
  "嵌入式", "RTOS", "ARM", "CUDA", "OpenCV",
  // Testing
  "Selenium", "自动化测试", "性能测试"
]

export function parseResume(text: string): ParsedResume {
  if (!text || text.trim().length < 5) {
    return { name: "", email: "", phone: "", education: [], experience: [], skills: [], projects: [], rawText: text || "" }
  }
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean)
  const name = extractName(lines)
  const email = extractEmail(text)
  const phone = extractPhone(text)
  const skills = extractSkills(text)
  const education = extractEducation(text)
  const experience = extractExperience(text)
  const projects = extractProjects(text)

  return { name, email, phone, education, experience, skills, projects, rawText: text }
}

/** Exported for testing */
export function extractName(lines: string[]): string {
  // Title keywords to skip — these are resume headings, not names
  const titleKeywords = /简历|Resume|CV|curriculum|个人信息|个人简介|求职|应聘|自荐/i
  // Common resume terms that look like 2-char CJK names but aren't
  const nonNameCJK = /^(本科|硕士|博士|研究生|学士|专科|大专|高中|电话|邮箱|手机|技能|经验|项目|教育|工作|实习|证书|获奖|荣誉|社团|志愿|评价|总结|简介|介绍|目标|期望|薪资|到岗|城市|地址|籍贯|民族|性别|年龄|生日|政治|面貌)$/i

  for (const line of lines.slice(0, 10)) {
    // Skip lines that are clearly resume titles
    if (titleKeywords.test(line)) continue

    // Chinese name: 2-4 CJK characters (possibly with spaces between)
    if (/^[一-龥]{2,4}$/.test(line) && !nonNameCJK.test(line)) return line
    if (/^[一-龥]\s+[一-龥]{1,3}$/.test(line)) return line.replace(/\s+/g, "")

    // English name: exactly "First Last" (2 words, each capitalized)
    if (/^[A-Z][a-z]{1,15}\s+[A-Z][a-z]{1,15}$/.test(line)) return line
    // First M. Last pattern (middle initial)
    if (/^[A-Z][a-z]+\s+[A-Z]\.\s+[A-Z][a-z]+$/.test(line)) return line
    // First-Middle Last or First Last-Surname (hyphenated)
    if (/^[A-Z][a-z]+-[A-Z][a-z]+\s+[A-Z][a-z]+$/.test(line)) return line
    if (/^[A-Z][a-z]+\s+[A-Z][a-z]+-[A-Z][a-z]+$/.test(line)) return line
  }

  // Fallback: first non-empty, non-title line that looks short enough to be a name
  for (const line of lines.slice(0, 10)) {
    if (titleKeywords.test(line)) continue
    // Prefer lines that look like names: short, no digits, no long words
    if (line.length >= 2 && line.length <= 8 && !/\d/.test(line)) return line
  }

  return lines[0]?.trim() || "未知"
}

function extractEmail(text: string): string {
  const match = text.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/)
  return match ? match[0] : ""
}

function extractPhone(text: string): string {
  const match = text.match(/1[3-9]\d{9}/)
  return match ? match[0] : ""
}

function containsSkill(text: string, skill: string): boolean {
  const lowerText = text.toLowerCase()
  const lowerSkill = skill.toLowerCase()
  // For ASCII skills, use word boundary to avoid partial matches (e.g., "Go" in "Golang")
  if (/^[a-zA-Z0-9#+/]/.test(skill)) {
    const escaped = lowerSkill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return new RegExp(`\\b${escaped}\\b`, "i").test(text)
  }
  // For CJK skills, ensure it's not a substring of a longer word by checking surrounding characters
  let idx = lowerText.indexOf(lowerSkill)
  while (idx !== -1) {
    const prev = idx > 0 ? text[idx - 1] : ""
    const next = idx + skill.length < text.length ? text[idx + skill.length] : ""
    const prevIsCJK = /[\u4e00-\u9fa5]/.test(prev)
    const nextIsCJK = /[\u4e00-\u9fa5]/.test(next)
    if (!prevIsCJK && !nextIsCJK) {
      return true
    }
    idx = lowerText.indexOf(lowerSkill, idx + 1)
  }
  return false
}

export function extractSkills(text: string): string[] {
  if (!text || text.trim().length < 2) return []
  const found: string[] = []
  for (const skill of SKILL_DICT) {
    if (containsSkill(text, skill)) {
      found.push(skill)
    }
  }
  // Also extract from "技能" or "Skills" section
  const skillSection = text.match(/(?:技能|Skills|专业技能|技术栈)[：:]?\s*([^\n]+(?:\n[^\n]+)*)/i)
  if (skillSection) {
    const items = skillSection[1].split(/[,，、;；\s]+/).filter(s => s.length > 1 && s.length < 20)
    for (const item of items) {
      if (!found.includes(item)) found.push(item)
    }
  }
  return Array.from(new Set(found))
}

export function extractEducation(text: string): Education[] {
  if (!text || text.trim().length < 5) return []
  const educations: Education[] = []

  // Find education section
  const eduSection = text.match(/(?:教育经历|教育背景|Education)[：:]?\s*([^]*?)(?=工作经历|实习经历|项目经历|技能|专业技能|自我评价|获奖|证书|$)/i)
  const eduText = eduSection ? eduSection[1] : text

  // Split into blocks by blank lines
  const blocks = eduText.split(/\n\s*\n/).filter(b => b.trim().length > 5)

  for (const block of blocks) {
    if (!/(?:大学|学院|学校|University|College|GPA|专业|本科|硕士|博士|专科)/i.test(block)) continue

    const schoolMatch = block.match(/([一-龥]+(?:大学|学院|学校|University|College))(?![一-龥])/i)
    const degreeMatch = block.match(/(本科|硕士|博士|专科|学士|研究生|MBA|Bachelor|Master|PhD|博士研究生|硕士研究生)/i)
    const majorMatch = block.match(/(?:专业|Major)[：:\s]*([^\n,，]+)/i)
      || block.match(/([一-龥]+(?:工程|科学|技术|学|管理|设计|专业|系))/)
    const yearMatch = block.match(/(\d{4})\s*[.\-年]?\s*(?:[-–至到]\s*(\d{4})\s*[.\-年]?)?/) || block.match(/(\d{4})届/)
    const gpaMatch = block.match(/GPA[：:\s]*(\d+\.?\d*)/i)

    if (schoolMatch) {
      const year = yearMatch
        ? (yearMatch[2] ? `${yearMatch[1]}-${yearMatch[2]}` : yearMatch[1])
        : ""
      educations.push({
        school: schoolMatch[1].trim(),
        major: majorMatch ? majorMatch[1].trim() : "",
        degree: degreeMatch ? degreeMatch[1] : "",
        year,
        startYear: yearMatch ? yearMatch[1] : undefined,
        endYear: yearMatch?.[2] || undefined,
        gpa: gpaMatch ? gpaMatch[1] : undefined,
      })
    }
  }

  // Fallback for unstructured text
  if (educations.length === 0) {
    const schoolAll = text.match(/([一-龥]+(?:大学|学院|学校))/g)
    const degreeAll = text.match(/(本科|硕士|博士|专科|学士|研究生|MBA|Bachelor|Master|PhD)/gi)
    const majorAll = text.match(/([一-龥]+(?:工程|科学|技术|学|管理|设计|专业))/g)

    if (schoolAll) {
      educations.push({
        school: schoolAll[0],
        major: majorAll ? majorAll[0] : "",
        degree: degreeAll ? degreeAll[0] : "",
        year: ""
      })
    }
  }

  return educations
}

export function extractExperience(text: string): Experience[] {
  if (!text || text.trim().length < 5) return []
  const experiences: Experience[] = []

  // Find experience section
  const expSection = text.match(/(?:工作经历|工作经验|实习经历|Experience)[：:]?\s*([^]*?)(?=项目经历|教育经历|技能|专业技能|自我评价|获奖|$)/i)
  const expText = expSection ? expSection[1] : ""

  if (!expText.trim()) return experiences

  // Split by date patterns to separate different experiences (supports "至今/present/now")
  const dateSplitRegex = /\n(?=[^\n]*(?:\d{4}[.\-年]\d{1,2}?[月]?\s*[-–至到]|至今|present|now))/i
  const blocks = expText.split(dateSplitRegex).filter(b => b.trim().length > 5)

  for (const block of blocks) {
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean)

    let company = ""
    let title = ""
    let duration = ""
    let description = ""

    // Pre-extract duration from any line that contains it
    for (const line of lines) {
      const dateMatch = line.match(/(\d{4}[.\-年]\d{1,2}[月]?\s*[-–至到]\s*(?:\d{4}[.\-年]?\d{1,2}[月]?|至今|present|now))/i)
      if (dateMatch && !duration) {
        duration = dateMatch[1].trim()
      }
      if (/\d{4}[.\-年]/.test(line) && !duration && line.length < 30) {
        duration = line.trim()
      }
    }

    for (const line of lines) {
      // Skip pure date lines
      if (/^\d{4}[.\-年]/.test(line) && line.length < 30 && !duration) {
        duration = line.trim()
        continue
      }

      // Remove date portion for cleaner company/title extraction
      const cleanLine = line.replace(/\d{4}[.\-年]\d{1,2}[月]?\s*[-–至到]\s*(?:\d{4}[.\-年]?\d{1,2}[月]?|至今|present|now)/gi, "").trim()

      // Company detection: has company keywords
      // Company + title detection
      if (!company && /公司|科技|网络|信息|集团|银行|证券|保险|传媒|教育|医疗|医药|生物/i.test(cleanLine)) {
        const companyMatch = cleanLine.match(/^(.+?(?:公司|科技|网络|信息|集团|银行|证券|保险|传媒|教育|医疗|医药|生物))\s+/)
        if (companyMatch) {
          company = companyMatch[1].trim()
          const rest = cleanLine.replace(companyMatch[1], "").trim()
          if (rest && !title) title = rest
        } else {
          company = cleanLine
        }
        continue
      }

      // Title-only detection
      if (!title && /工程师|开发|设计|经理|运营|实习|助理|专员|主管|总监|研究员|分析师|架构师|顾问|代表|生|员/i.test(cleanLine)) {
        title = cleanLine
        continue
      }

      // Everything else is part of description (skip lines already used as duration)
      if (line.length > 3 && !/^[#\-•*]/.test(line) && line !== duration) {
        description += (description ? " " : "") + line
      }
    }

    if (company || title) {
      // Parse date range into startDate/endDate
      let startDate: string | undefined
      let endDate: string | undefined
      const dateMatch = duration.match(/(\d{4})[.\-年]\s*(\d{1,2})?[月]?\s*[-–至到]\s*(\d{4})[.\-年]?\s*(\d{1,2})?[月]?/)
      if (dateMatch) {
        startDate = `${dateMatch[1]}.${(dateMatch[2] || "01").padStart(2, "0")}`
        endDate = `${dateMatch[3]}.${(dateMatch[4] || "01").padStart(2, "0")}`
      } else {
        const presentMatch = duration.match(/(\d{4})[.\-年]\s*(\d{1,2})?[月]?\s*[-–至到]\s*(至今|present|now)/i)
        if (presentMatch) {
          startDate = `${presentMatch[1]}.${(presentMatch[2] || "01").padStart(2, "0")}`
          endDate = "至今"
        } else {
          const singleMatch = duration.match(/(\d{4})[.\-年]/)
          if (singleMatch) startDate = `${singleMatch[1]}.01`
        }
      }

      experiences.push({ company, title, duration, description: description.trim(), startDate, endDate })
    }
  }

  // Fallback for unstructured text
  if (experiences.length === 0) {
    const companyMatches = text.match(/([一-龥]+(?:公司|科技|网络|信息|集团))/g)
    const titleMatches = text.match(/([一-龥]+(?:工程师|开发|设计|经理|运营|实习|专员|研究员))/g)
    if (companyMatches && titleMatches) {
      experiences.push({
        company: companyMatches[0],
        title: titleMatches[0],
        duration: "",
        description: "",
      })
    }
  }

  return experiences
}

export function extractProjects(text: string): Project[] {
  if (!text || text.trim().length < 5) return []
  const projects: Project[] = []

  // Find projects section
  const projSection = text.match(/(?:项目经历|项目经验|Projects)[：:]?\s*([^]*?)(?=工作经历|实习经历|教育经历|技能|专业技能|自我评价|获奖|$)/i)
  const projText = projSection ? projSection[1] : ""

  if (!projText.trim()) return projects

  // Robust block splitting: blank lines, bullet points, or numbered lines
  const blocks = projText
    .split(/\n\s*\n|\n(?=[\d一二三四五六七八九十]+[.、.])|\n(?=[•\-\*])|\n(?=\d{4}[.\-年])/)
    .filter(b => b.trim().length > 5)

  for (const block of blocks.slice(0, 5)) {
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) continue

    const name = lines[0].length < 50 ? lines[0] : lines[0].slice(0, 50)
    const description = lines.slice(1).join(" ").trim()

    // Detect tech stack from description
    const descText = block.toLowerCase()
    const techStack = SKILL_DICT.filter(skill => {
      const lower = skill.toLowerCase()
      // Use word boundary for ASCII, substring for CJK
      if (/^[a-zA-Z]/.test(skill)) {
        return new RegExp(`\\b${lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(descText)
      }
      return descText.includes(lower)
    })

    if (name.length > 1) {
      projects.push({ name, description, techStack })
    }
  }

  // Fallback: extract project names from unstructured text
  if (projects.length === 0) {
    const projNames = projText.match(/[一-龥a-zA-Z][一-龥a-zA-Z0-9_\-]{2,30}/g)
    if (projNames) {
      for (const name of projNames.slice(0, 3)) {
        projects.push({ name, description: "", techStack: [] })
      }
    }
  }

  return projects
}
