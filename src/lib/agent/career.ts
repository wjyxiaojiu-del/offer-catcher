// ============================================================
// Career Advice Module — 全面职业规划
// ============================================================

import type { ParsedResume, Job } from "@/types"

/**
 * Build a comprehensive career advice prompt.
 */
export function buildCareerPrompt(
  resume: ParsedResume,
  targetJob?: Job
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `你是一位资深职业规划师，拥有 10 年以上猎头和职业咨询经验。

请根据候选人的简历，提供全面的职业规划建议，包括：
1. 当前竞争力评估（优势和短板）
2. 适合的岗位方向（2-3 个推荐方向）
3. 行业趋势分析
4. 短期（3个月）和长期（1-2年）发展建议

要求：
- 基于数据和行业认知，不要泛泛而谈
- 建议要具体可执行
- 用中文回答，结构清晰`

  const jobContext = targetJob
    ? `\n目标岗位：${targetJob.title} @ ${targetJob.company}\n岗位要求：${targetJob.description}\n技能要求：${targetJob.skills.join("、")}`
    : "\n（未指定目标岗位，请根据简历推荐适合的方向）"

  const userPrompt = `候选人简历：
姓名：${resume.name}
技能：${resume.skills.join("、") || "未提取到"}
学历：${resume.education.map(e => `${e.school} ${e.degree} ${e.major}`).join("；") || "未提取到"}
经历：${resume.experience.map(e => `${e.company} ${e.title} ${e.duration}`).join("；") || "未提取到"}
项目：${resume.projects.map(p => p.name).join("、") || "无"}
${jobContext}

请提供职业规划建议。`

  return { systemPrompt, userPrompt }
}

/**
 * Build a skills gap analysis prompt.
 */
export function buildGapAnalysisPrompt(
  resume: ParsedResume,
  targetJob: Job
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `你是一位技术招聘专家。请对比候选人的技能和目标岗位的要求，生成技能差距分析。

输出格式（JSON）：
{
  "matched": ["已掌握的技能"],
  "missing": ["缺失的技能"],
  "partial": ["部分掌握的技能"],
  "priority": ["优先学习的技能（按重要性排序）"],
  "summary": "一句话总结差距"
}`

  const userPrompt = `候选人技能：${resume.skills.join("、") || "无"}
目标岗位：${targetJob.title}
要求技能：${targetJob.skills.join("、") || "未指定"}
岗位描述：${targetJob.description}

请分析技能差距。`

  return { systemPrompt, userPrompt }
}

/**
 * Build a learning roadmap prompt.
 */
export function buildRoadmapPrompt(
  missingSkills: string[]
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `你是一位技术学习规划师。请根据缺失技能列表，制定一个分阶段的学习路线图。

要求：
1. 按优先级排序
2. 每个技能给出推荐学习资源（课程/书籍/项目）
3. 估算学习时间
4. 设置里程碑检查点
5. 用中文回答`

  const userPrompt = missingSkills.length > 0
    ? `需要学习的技能：${missingSkills.join("、")}

请制定学习路线图。`
    : "候选人技能已基本覆盖目标岗位要求，请给出进一步提升的建议。"

  return { systemPrompt, userPrompt }
}
