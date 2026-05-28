export interface ParsedResume {
  name: string
  email: string
  phone: string
  education: Education[]
  experience: Experience[]
  skills: string[]
  projects: Project[]
  rawText: string
}

export interface Education {
  school: string
  major: string
  degree: string
  year: string
}

export interface Experience {
  company: string
  title: string
  duration: string
  description: string
}

export interface Project {
  name: string
  description: string
  techStack: string[]
}

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
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean)

  // Extract name (first non-empty line or line with 2-4 Chinese chars)
  const name = extractName(lines)

  // Extract contact info
  const email = extractEmail(text)
  const phone = extractPhone(text)

  // Extract skills
  const skills = extractSkills(text)

  // Extract education
  const education = extractEducation(text)

  // Extract experience
  const experience = extractExperience(text)

  // Extract projects
  const projects = extractProjects(text)

  return { name, email, phone, education, experience, skills, projects, rawText: text }
}

function extractName(lines: string[]): string {
  for (const line of lines.slice(0, 5)) {
    // Chinese name: 2-4 chars, no digits/special chars
    if (/^[\u4e00-\u9fa5]{2,4}$/.test(line)) return line
    // English name
    if (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(line)) return line
  }
  return lines[0] || "未知"
}

function extractEmail(text: string): string {
  const match = text.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/)
  return match ? match[0] : ""
}

function extractPhone(text: string): string {
  const match = text.match(/1[3-9]\d{9}/)
  return match ? match[0] : ""
}

function extractSkills(text: string): string[] {
  const found: string[] = []
  const lowerText = text.toLowerCase()
  for (const skill of SKILL_DICT) {
    if (lowerText.includes(skill.toLowerCase())) {
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

function extractEducation(text: string): Education[] {
  const educations: Education[] = []
  const eduPatterns = [
    /(\d{4})[\s.-]*(\d{4})?[\s]*[：:]?\s*(.+?(?:大学|学院|学校|University|College)).*?(.+?(?:专业|学|系))?/gi,
  ]
  // Simple extraction
  const schoolMatch = text.match(/([\u4e00-\u9fa5]+(?:大学|学院|学校))/g)
  const degreeMatch = text.match(/(本科|硕士|博士|专科|学士|研究生|MBA|Bachelor|Master|PhD)/gi)
  const majorMatch = text.match(/([\u4e00-\u9fa5]+(?:工程|科学|技术|学|管理|设计|专业))/g)

  if (schoolMatch) {
    educations.push({
      school: schoolMatch[0],
      major: majorMatch ? majorMatch[0] : "",
      degree: degreeMatch ? degreeMatch[0] : "",
      year: ""
    })
  }
  return educations
}

function extractExperience(text: string): Experience[] {
  const experiences: Experience[] = []
  // Look for company + title patterns
  const expSection = text.match(/(?:工作经历|工作经验|实习经历|Experience)[：:]?\s*([^]*?)(?=项目经历|教育经历|技能|$)/i)
  if (expSection) {
    const lines = expSection[1].split("\n").filter(l => l.trim())
    let current: Partial<Experience> = {}
    for (const line of lines) {
      if (/公司|科技|网络|信息/.test(line) && !current.company) {
        current.company = line.trim()
      } else if (/工程师|开发|设计|经理|运营|实习/.test(line) && !current.title) {
        current.title = line.trim()
      } else if (/\d{4}/.test(line) && !current.duration) {
        current.duration = line.trim()
      }
    }
    if (current.company || current.title) {
      experiences.push({ company: current.company || "", title: current.title || "", duration: current.duration || "", description: "" })
    }
  }
  return experiences
}

function extractProjects(text: string): Project[] {
  const projects: Project[] = []
  const projSection = text.match(/(?:项目经历|项目经验|Projects)[：:]?\s*([^]*?)(?=工作经历|教育经历|技能|自我评价|$)/i)
  if (projSection) {
    const projNames = projSection[1].match(/[\u4e00-\u9fa5a-zA-Z][\u4e00-\u9fa5a-zA-Z0-9_-]{2,30}/g)
    if (projNames) {
      for (const name of projNames.slice(0, 3)) {
        projects.push({ name, description: "", techStack: [] })
      }
    }
  }
  return projects
}
