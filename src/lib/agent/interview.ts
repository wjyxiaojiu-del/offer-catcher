// ============================================================
// Mock Interview Module — 混合模式面试模拟
// ============================================================

import type { Job } from "@/types"

export type InterviewType = "technical" | "behavioral" | "mixed"

export interface InterviewMessage {
  role: "interviewer" | "candidate"
  content: string
}

export interface InterviewSummary {
  type: InterviewType
  totalQuestions: number
  history: InterviewMessage[]
}

/**
 * Auto-detect interview type based on job description.
 */
export function detectInterviewType(job: Job): InterviewType {
  const title = job.title.toLowerCase()
  const desc = job.description.toLowerCase()
  const skills = job.skills.map(s => s.toLowerCase())
  const allText = `${title} ${desc} ${skills.join(" ")}`

  const technicalKeywords = ["工程师", "开发", "架构", "前端", "后端", "算法", "engineer", "developer", "react", "vue", "python", "java", "typescript", "golang", "rust", "c++"]
  const behavioralKeywords = ["产品", "运营", "市场", "销售", "管理", "经理", "主管", "总监", "pm", "product", "manager", "marketing", "团队协作", "跨部门", "沟通", "leadership"]

  const techScore = technicalKeywords.filter(k => allText.includes(k)).length
  const behScore = behavioralKeywords.filter(k => allText.includes(k)).length

  // "全栈" or both technical and behavioral keywords → mixed
  if (allText.includes("全栈") || (techScore > 0 && behScore > 0)) return "mixed"
  if (techScore > 0) return "technical"
  if (behScore > 0) return "behavioral"
  return "mixed"
}

/**
 * Build the initial interview prompt for LLM.
 */
export function buildInterviewPrompt(
  type: InterviewType,
  job: Job,
  resumeText: string
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `你是一位专业的面试官。请根据候选人的简历和目标岗位，进行一场${type === "technical" ? "技术面试" : type === "behavioral" ? "行为面试" : "综合面试（技术+行为）"}。

规则：
1. 每次只问一个问题
2. 问题要具体、有针对性，不要泛泛而谈
3. 技术面试：考察核心概念、项目深挖、系统设计、算法思维
4. 行为面试：使用 STAR 法则引导，考察自我认知、团队协作、问题解决
5. 根据候选人回答质量决定是否追问
6. 用中文提问，语气专业但友好

输出格式：只输出面试问题，不要加多余前缀。`

  const interviewTypeDesc = type === "technical"
    ? "技术面试，重点考察技术能力和项目经验"
    : type === "behavioral"
      ? "行为面试，重点考察软技能和职业素养"
      : "综合面试，先问技术再问行为"

  const userPrompt = `
目标岗位：${job.title} @ ${job.company}
岗位要求：${job.description}
技能要求：${job.skills.join("、") || "未指定"}
经验要求：${job.experience}
面试类型：${interviewTypeDesc}

候选人简历：
${resumeText}

请开始面试，提出第一个问题。`

  return { systemPrompt, userPrompt }
}

/**
 * Build a follow-up prompt based on interview history.
 */
export function buildFollowUpPrompt(
  history: InterviewMessage[],
  type: InterviewType
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `你是一位专业的面试官，正在进行${type === "technical" ? "技术面试" : type === "behavioral" ? "行为面试" : "综合面试"}。

规则：
1. 根据候选人的上一个回答，决定是追问还是提新问题
2. 如果回答不够深入，追问细节
3. 如果回答已经充分，转入下一个话题
4. 每次只问一个问题
5. 用中文提问

输出格式：只输出面试问题或追问，不要加多余前缀。`

  const conversation = history
    .map(m => `${m.role === "interviewer" ? "面试官" : "候选人"}：${m.content}`)
    .join("\n")

  const userPrompt = `以下是目前的面试对话：

${conversation}

请根据候选人的回答，提出下一个问题或追问。`

  return { systemPrompt, userPrompt }
}

/**
 * Build a structured interview summary from Q&A history.
 */
export function buildInterviewSummary(
  history: InterviewMessage[],
  type: InterviewType
): InterviewSummary {
  const questionCount = history.filter(m => m.role === "interviewer").length
  return {
    type,
    totalQuestions: questionCount,
    history,
  }
}
