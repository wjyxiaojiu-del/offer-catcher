import OpenAI from "openai"

const client = new OpenAI({
  apiKey: process.env.MIMO_API_KEY,
  baseURL: process.env.MIMO_BASE_URL || "https://token-plan-sgp.xiaomimimo.com/v1",
})

const MODEL = process.env.MIMO_MODEL || "mimo-v2.5-pro"

async function chat(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  })
  return res.choices[0]?.message?.content || ""
}

// Extract JSON from LLM response (handles markdown code blocks)
function extractJSON(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (match) return match[1].trim()
  // Try to find raw JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]
  return text.trim()
}

// ============ AI Resume Parsing ============

interface AIResume {
  name: string
  email: string
  phone: string
  education: { school: string; major: string; degree: string; year: string }[]
  experience: { company: string; title: string; duration: string; description: string }[]
  skills: string[]
  projects: { name: string; description: string; techStack: string[] }[]
  summary: string
}

export async function aiParseResume(text: string): Promise<AIResume> {
  const systemPrompt = `你是一个专业的简历解析助手。从用户提供的简历文本中提取结构化信息。
请严格按照以下 JSON 格式输出，不要输出其他内容：
{
  "name": "姓名",
  "email": "邮箱",
  "phone": "电话",
  "education": [{"school": "学校", "major": "专业", "degree": "学历(本科/硕士/博士等)", "year": "年份"}],
  "experience": [{"company": "公司", "title": "职位", "duration": "时间", "description": "描述"}],
  "skills": ["技能1", "技能2"],
  "projects": [{"name": "项目名", "description": "描述", "techStack": ["技术1"]}],
  "summary": "一句话总结候选人背景"
}`

  const result = await chat(systemPrompt, `请解析以下简历：\n\n${text}`)
  try {
    return JSON.parse(extractJSON(result))
  } catch {
    // Fallback to basic fields
    return {
      name: text.split("\n")[0]?.trim() || "未知",
      email: text.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/)?.[0] || "",
      phone: text.match(/1[3-9]\d{9}/)?.[0] || "",
      education: [], experience: [], skills: [], projects: [],
      summary: "解析失败，请检查简历格式",
    }
  }
}

// ============ AI Match Analysis ============

interface AIMatchAnalysis {
  score: number
  analysis: string
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  skillMatch: { matched: string[]; missing: string[] }
}

export async function aiAnalyzeMatch(
  resume: { name: string; skills: string[]; education: any[]; experience: any[]; projects: any[]; summary?: string },
  job: { title: string; company: string; description: string; requirements: string[]; skills: string[]; education: string; experience: string }
): Promise<AIMatchAnalysis> {
  const systemPrompt = `你是一个资深的求职顾问和 HR 专家。你需要分析候选人的简历与目标岗位的匹配度。
请从技能、学历、经验、项目四个维度综合评估，给出 0-100 的匹配分数。
请严格按照以下 JSON 格式输出：
{
  "score": 75,
  "analysis": "详细的分析段落，200字左右",
  "strengths": ["优势1", "优势2"],
  "weaknesses": ["不足1", "不足2"],
  "suggestions": ["建议1", "建议2", "建议3"],
  "skillMatch": {"matched": ["已匹配技能"], "missing": ["缺失技能"]}
}`

  const userPrompt = `候选人简历：
姓名: ${resume.name}
技能: ${resume.skills.join(", ")}
教育: ${JSON.stringify(resume.education)}
经历: ${JSON.stringify(resume.experience)}
项目: ${JSON.stringify(resume.projects)}
${resume.summary ? `总结: ${resume.summary}` : ""}

目标岗位：
职位: ${job.title} @ ${job.company}
要求学历: ${job.education}
要求经验: ${job.experience}
岗位描述: ${job.description}
任职要求: ${job.requirements.join("; ")}
所需技能: ${job.skills.join(", ")}

请分析匹配度并给出建议。`

  const result = await chat(systemPrompt, userPrompt)
  try {
    return JSON.parse(extractJSON(result))
  } catch {
    return {
      score: 50,
      analysis: "AI 分析解析失败，已降级为基础匹配。",
      strengths: [], weaknesses: [],
      suggestions: ["建议手动对比 JD 与简历的匹配度"],
      skillMatch: { matched: [], missing: job.skills },
    }
  }
}

// ============ AI Resume Optimization ============

export async function aiOptimizeResume(
  resume: { name: string; skills: string[]; education: any[]; experience: any[]; projects: any[]; rawText: string },
  jdText: string
): Promise<{
  overallScore: number
  overall: string
  sections: { title: string; score: number; feedback: string; improvements: string[]; icon: string }[]
}> {
  const systemPrompt = `你是一个简历优化专家。用户会提供自己的简历和一个目标岗位的 JD。
请分析简历与 JD 的匹配度，并给出针对性的优化建议。

请严格按照以下 JSON 格式输出：
{
  "overallScore": 65,
  "overall": "综合评价，100字左右",
  "sections": [
    {"title": "技能匹配度", "score": 70, "feedback": "评价", "improvements": ["建议1", "建议2"], "icon": "🎯"},
    {"title": "教育背景", "score": 80, "feedback": "评价", "improvements": ["建议"], "icon": "🎓"},
    {"title": "工作经验", "score": 50, "feedback": "评价", "improvements": ["建议"], "icon": "💼"},
    {"title": "项目经历", "score": 60, "feedback": "评价", "improvements": ["建议"], "icon": "🚀"},
    {"title": "简历表达", "score": 55, "feedback": "评价", "improvements": ["建议"], "icon": "✍️"}
  ]
}`

  const userPrompt = `我的简历：
${resume.rawText}

目标岗位 JD：
${jdText}

请分析匹配度并给出优化建议。`

  const result = await chat(systemPrompt, userPrompt)
  try {
    return JSON.parse(extractJSON(result))
  } catch {
    return {
      overallScore: 50,
      overall: "AI 分析解析失败，请重试。",
      sections: [],
    }
  }
}
