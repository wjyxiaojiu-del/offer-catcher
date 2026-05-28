import { NextResponse } from "next/server"
import { generateOptimizationReport } from "@/lib/matcher"
import type { Job } from "@/data/jobs"

function parseJD(text: string): Job {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean)

  // Extract title (first meaningful line)
  let title = lines[0] || "自定义岗位"
  for (const line of lines.slice(0, 5)) {
    if (line.length > 2 && line.length < 30 && !line.includes("：") && !line.includes(":")) {
      title = line; break
    }
  }

  // Extract company
  let company = "未知公司"
  const companyMatch = text.match(/公司[名称：:]*\s*(.+)/i) || text.match(/企业[名称：:]*\s*(.+)/i)
  if (companyMatch) company = companyMatch[1].trim().slice(0, 20)

  // Extract skills from JD
  const SKILL_KEYWORDS = [
    "JavaScript", "TypeScript", "Python", "Java", "Go", "Rust", "C", "C++", "C#", "PHP",
    "React", "Vue", "Angular", "Next.js", "HTML", "CSS", "Sass", "Tailwind", "Webpack",
    "Node.js", "Express", "Django", "Flask", "Spring", "FastAPI", "Gin",
    "SQL", "MySQL", "PostgreSQL", "MongoDB", "Redis", "Elasticsearch", "Kafka",
    "PyTorch", "TensorFlow", "NLP", "大模型", "Transformer", "机器学习", "深度学习", "计算机视觉", "LLM",
    "Docker", "Kubernetes", "AWS", "Linux", "Git", "Jenkins", "CI/CD", "Terraform",
    "Figma", "Sketch", "Photoshop", "Axure", "Tableau", "SPSS", "Excel",
    "数据分析", "需求分析", "产品设计", "用户研究", "活动策划", "内容运营",
    "农业", "园艺", "育种", "田间试验", "论文写作",
    "嵌入式", "RTOS", "ARM", "CUDA", "OpenCV",
    "Selenium", "自动化测试", "性能测试",
    "Swift", "Kotlin", "Flutter", "React Native", "Unity"
  ]

  const lowerText = text.toLowerCase()
  const skills = SKILL_KEYWORDS.filter(s => lowerText.includes(s.toLowerCase()))

  // Extract requirements
  const requirements: string[] = []
  const reqPatterns = [
    /(?:要求|任职要求|岗位要求|职位要求|Requirements)[：:]?\s*([^]*?)(?=福利|待遇|薪资|公司|$)/i,
    /(?:必备|必须|需要)[：:]?\s*([^\n]+)/gi
  ]
  for (const pattern of reqPatterns) {
    const match = text.match(pattern)
    if (match) {
      const items = match[1].split(/[\n•·\-\d+\.、；;]+/).filter(s => s.trim().length > 2)
      requirements.push(...items.map(s => s.trim()).slice(0, 10))
    }
  }
  if (requirements.length === 0) {
    // Fallback: extract lines that look like requirements
    for (const line of lines) {
      if ((line.includes("熟悉") || line.includes("精通") || line.includes("了解") || line.includes("掌握") || line.includes("有") || line.includes("具备")) && line.length > 4 && line.length < 60) {
        requirements.push(line.replace(/^[•·\-\d+\.、]+\s*/, ""))
      }
    }
  }

  // Extract education requirement
  let education = "本科及以上"
  if (text.includes("硕士") || text.includes("研究生")) education = "硕士及以上"
  else if (text.includes("博士")) education = "博士"
  else if (text.includes("大专") || text.includes("专科")) education = "大专及以上"
  else if (text.includes("不限")) education = "不限"

  // Extract experience
  let experience = "不限"
  const expMatch = text.match(/(\d+)[\s-]*(\d+)?\s*年[工作经验]*/)
  if (expMatch) experience = `${expMatch[1]}-${expMatch[2] || parseInt(expMatch[1]) + 2}年`
  else if (text.includes("应届") || text.includes("实习")) experience = "0-1年"

  // Extract salary
  let salary = "面议"
  const salaryMatch = text.match(/(\d+)[kK]?[\s-~—至]+(\d+)[kK]?/)
  if (salaryMatch) salary = `${salaryMatch[1]}K-${salaryMatch[2]}K`

  // Extract location
  let location = "未知"
  const cities = ["北京", "上海", "深圳", "杭州", "广州", "成都", "武汉", "南京", "长沙", "西安", "苏州", "重庆"]
  for (const city of cities) {
    if (text.includes(city)) { location = city; break }
  }

  // Extract tags
  const tags: string[] = []
  if (text.match(/AI|人工智能|大模型|机器学习/i)) tags.push("AI")
  if (text.match(/前端|frontend/i)) tags.push("前端")
  if (text.match(/后端|backend/i)) tags.push("后端")
  if (text.match(/全栈|fullstack/i)) tags.push("全栈")
  if (text.match(/数据|data/i)) tags.push("数据")
  if (text.match(/产品|product/i)) tags.push("产品")
  if (text.match(/设计|design/i)) tags.push("设计")
  if (tags.length === 0) tags.push("自定义")

  return {
    id: "custom-jd",
    title,
    company,
    location,
    salary,
    experience,
    education,
    description: text.slice(0, 500),
    requirements: requirements.length > 0 ? requirements : ["详见 JD 描述"],
    skills: skills.length > 0 ? skills : ["详见 JD 描述"],
    tags,
    postedAt: new Date().toISOString().slice(0, 10),
    applyUrl: ""
  }
}

export async function POST(req: Request) {
  try {
    const { resume, jdText } = await req.json()

    if (!resume) return NextResponse.json({ error: "缺少简历数据" }, { status: 400 })
    if (!jdText || jdText.trim().length < 10) return NextResponse.json({ error: "JD 内容过短，请粘贴完整的岗位描述" }, { status: 400 })

    const job = parseJD(jdText)
    const report = generateOptimizationReport(resume, job)

    return NextResponse.json({ report, job, jdText })
  } catch (error) {
    console.error("JD optimize error:", error)
    return NextResponse.json({ error: "分析失败" }, { status: 500 })
  }
}
