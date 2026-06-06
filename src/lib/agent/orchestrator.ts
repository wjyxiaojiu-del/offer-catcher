// ============================================================
// ReAct Orchestrator — Task decomposition & execution
// ============================================================

import type { AgentContext, Task, ToolCall, ReActStep, AgentResponse, ParsedIntent } from "./types"
import { createToolRegistry } from "./tools"
import { saveMessage, getConversationHistory } from "./memory"
import { withTimeout } from "@/lib/utils"
import { aiRecognizeIntent } from "@/lib/ai"
import { planTasksByLLM } from "./llm-planner"
import { generateResponseByLLM } from "./llm-responder"
import { jobs } from "@/data/jobs"

// ========== Intent Recognition ==========

function recognizeIntentByRules(userInput: string, ctx: AgentContext): ParsedIntent {
  const lower = userInput.toLowerCase()

  // Fast rule-based intent detection (no LLM call for common patterns)
  if (/匹配|推荐|找.*工作|适合.*岗位|帮我找/.test(lower)) {
    const tags: string[] = []
    if (/前端|react|vue|css|html/.test(lower)) tags.push("前端")
    if (/后端|java|go|python|node/.test(lower)) tags.push("后端")
    if (/ai|算法|大模型|nlp|cv|机器学习/.test(lower)) tags.push("AI")
    if (/产品|pm|原型|需求/.test(lower)) tags.push("产品")
    if (/数据|分析|sql|可视化/.test(lower)) tags.push("数据")
    return { intent: "match_jobs", params: { tags, query: userInput }, confidence: 0.9 }
  }

  if (/优化|修改|改进|怎么改|建议/.test(lower)) {
    return { intent: "optimize_resume", params: { query: userInput }, confidence: 0.85 }
  }

  if (/解析|提取|识别|上传.*简历/.test(lower)) {
    return { intent: "parse_resume", params: { query: userInput }, confidence: 0.9 }
  }

  if (/投递|申请|发送|一键投递/.test(lower)) {
    return { intent: "apply_jobs", params: { query: userInput }, confidence: 0.85 }
  }

  if (/面试|准备|题库|面经|会问什么/.test(lower)) {
    return { intent: "mock_interview", params: { query: userInput }, confidence: 0.8 }
  }

  if (/职业|规划|发展|转行|方向/.test(lower)) {
    return { intent: "career_advice", params: { query: userInput }, confidence: 0.8 }
  }

  // Default: try to infer from context
  if (ctx.resume) {
    return { intent: "match_jobs", params: { query: userInput }, confidence: 0.6 }
  }

  return { intent: "general_chat", params: { query: userInput }, confidence: 0.5 }
}

export async function recognizeIntent(
  userInput: string,
  ctx: AgentContext
): Promise<ParsedIntent> {
  // Step 1: Fast rule-based path (0 cost, 0 latency)
  const ruleResult = recognizeIntentByRules(userInput, ctx)
  if (ruleResult.confidence >= 0.9) {
    return ruleResult
  }

  // Step 2: LLM fallback for ambiguous or complex queries
  try {
    const history = await getConversationHistory(ctx.sessionId, 3)
    const aiResult = await withTimeout(
      aiRecognizeIntent(
        userInput,
        history.map((h) => h.content)
      ),
      3000,
      null,
      { silent: true }
    )
    if (
      aiResult &&
      aiResult.confidence > ruleResult.confidence &&
      aiResult.confidence >= 0.6
    ) {
      return {
        intent: aiResult.intent as import("./types").UserIntent,
        params: { ...(aiResult.params as Record<string, unknown>), query: userInput },
        confidence: aiResult.confidence,
      }
    }
  } catch {
    // LLM intent recognition failed, fall back to rules
  }

  return ruleResult
}

// ========== Task Planning ==========

function planTasksByRules(intent: ParsedIntent, ctx: AgentContext): Task[] {
  const tasks: Task[] = []

  switch (intent.intent) {
    case "parse_resume":
      tasks.push(createTask("parse", "解析简历", "从文本中提取结构化简历信息", "resumeParser"))
      break

    case "match_jobs":
      if (!ctx.resume) {
        tasks.push(createTask("parse", "解析简历", "先解析简历以获取匹配基础", "parseResumeText"))
      }
      tasks.push(createTask("match", "岗位匹配", "将简历与岗位库进行多维度匹配", "matchJobs", ["parse"]))
      tasks.push(createTask("analyze", "AI分析", "对Top匹配结果进行深度分析", "analyzeTopMatches", ["match"]))
      tasks.push(createTask("synthesize", "生成报告", "汇总匹配结果生成可读报告", "summarizeMatches", ["analyze"]))
      break

    case "optimize_resume":
      if (!ctx.resume) {
        tasks.push(createTask("parse", "解析简历", "先解析简历", "parseResumeText"))
      }
      tasks.push(createTask("identify_job", "识别目标岗位", "从用户输入或记忆中确定目标岗位", "advisor", ["parse"], { type: "identify" }))
      tasks.push(createTask("optimize", "生成优化建议", "针对目标岗位生成简历优化报告", "advisor", ["identify_job"], { type: "optimize" }))
      break

    case "apply_jobs":
      if (!ctx.resume) {
        tasks.push(createTask("parse", "解析简历", "先解析简历", "parseResumeText"))
      }
      tasks.push(createTask("match", "筛选岗位", "匹配并筛选适合投递的岗位", "matchJobs", ["parse"]))
      tasks.push(createTask("apply", "执行投递", "模拟投递选中的岗位", "simulateApply", ["match"]))
      break

    case "mock_interview":
      tasks.push(createTask("prep", "面试准备", "基于简历和岗位生成面试题", "advisor", [], { type: "interview" }))
      break

    case "career_advice":
      tasks.push(createTask("advise", "职业建议", "基于简历给出职业发展建议", "advisor", [], { type: "career" }))
      break

    default:
      tasks.push(createTask("chat", "通用回复", "直接回答用户问题", "summarizeMatches"))
  }

  return tasks
}

function createTask(
  id: string,
  name: string,
  description: string,
  agent: string,
  dependencies: string[] = [],
  params?: Record<string, unknown>
): Task {
  return { id, name, description, status: "pending", agent, dependencies, params }
}

// ========== Task Execution ==========

export async function executeTasks(
  tasks: Task[],
  ctx: AgentContext
): Promise<{ completed: Task[]; failed: Task[] }> {
  const registry = createToolRegistry(ctx)
  const completed: Task[] = []
  const failed: Task[] = []
  const pending = new Map(tasks.map(t => [t.id, t]))

  async function runTask(task: Task): Promise<void> {
    if (task.status !== "pending") return

    // Check dependencies
    const unmet = task.dependencies.filter(d => !completed.some(c => c.id === d) && !failed.some(f => f.id === d))
    if (unmet.length > 0) {
      // Wait for dependencies — simple sequential execution for now
      return
    }

    task.status = "running"
    task.startTime = Date.now()

    try {
      const result = await executeAgentTask(task, ctx, registry)
      task.result = result
      task.status = "completed"
      task.endTime = Date.now()
      completed.push(task)
    } catch (err: any) {
      task.error = err.message || String(err)
      task.status = "failed"
      task.endTime = Date.now()
      failed.push(task)
    }
  }

  // Execute in waves (respect dependencies)
  while (pending.size > 0) {
    const runnable = Array.from(pending.values()).filter(t => {
      if (t.status !== "pending") return false
      return t.dependencies.every(d => completed.some(c => c.id === d))
    })

    if (runnable.length === 0) {
      // Deadlock or all remaining have failed deps
      const remaining = Array.from(pending.values()).filter(t => t.status === "pending")
      for (const t of remaining) {
        t.status = "failed"
        t.error = "依赖任务失败或未满足"
        failed.push(t)
        pending.delete(t.id)
      }
      break
    }

    // Run independent tasks in parallel
    await Promise.all(runnable.map(t => runTask(t).then(() => pending.delete(t.id))))
  }

  return { completed, failed }
}

async function executeAgentTask(
  task: Task,
  _ctx: AgentContext,
  registry: Record<string, import("./types").Tool>
): Promise<unknown> {
  const tool = registry[task.agent]
  if (!tool) {
    throw new Error(`未知Agent类型: ${task.agent}`)
  }
  return tool.execute(task.params || {})
}

// ========== Main Orchestrator Entry ==========

export async function runAgent(
  userInput: string,
  ctx: AgentContext
): Promise<AgentResponse> {
  const start = Date.now()
  const thinking: string[] = []

  // Step 1: Intent recognition
  thinking.push("🧠 正在理解您的意图...")
  const intent = await recognizeIntent(userInput, ctx)
  thinking.push(`识别到意图: ${intent.intent} (置信度: ${Math.round(intent.confidence * 100)}%)`)
  ;(ctx as any)._intent = intent

  // Step 2: Load memory
  const history = await getConversationHistory(ctx.sessionId, 5)
  ctx.memory.shortTerm["last_intent"] = intent.intent

  // Step 3: Plan tasks (LLM-first with rule fallback)
  const useLLM = process.env.DISABLE_LLM_PLANNER !== "true"
  let tasks: Task[] = []

  if (useLLM) {
    thinking.push("📋 LLM 正在规划任务...")
    const llmTasks = await planTasksByLLM(intent, ctx)
    if (llmTasks && llmTasks.length > 0) {
      tasks = llmTasks
      thinking.push("✅ LLM 规划完成")
    } else {
      thinking.push("⚠️ LLM 规划失败，回退到规则引擎")
    }
  }

  if (tasks.length === 0) {
    thinking.push("📋 规则引擎分解任务...")
    tasks = planTasksByRules(intent, ctx)
  }

  ctx.tasks = tasks
  for (const t of tasks) {
    thinking.push(`  • [${t.agent}] ${t.name}`)
  }

  // Step 4: Execute
  thinking.push("🚀 正在执行...")
  const { completed, failed } = await executeTasks(tasks, ctx)

  if (failed.length > 0) {
    thinking.push(`⚠️ ${failed.length} 个任务失败: ${failed.map(f => f.name).join(", ")}`)
  }

  // Step 5: Generate response (LLM-first with rule fallback)
  let content: string | null = null
  if (useLLM) {
    thinking.push("✍️ LLM 正在生成回复...")
    content = await generateResponseByLLM(intent, completed, failed, ctx)
    if (content) {
      thinking.push("✅ LLM 回复生成完成")
    } else {
      thinking.push("⚠️ LLM 回复生成失败，回退到模板")
    }
  }
  if (!content) {
    content = generateResponseByRules(intent, completed, failed, ctx)
  }

  // Step 6: Save to memory
  await saveMessage(ctx.sessionId, "user", userInput)
  await saveMessage(ctx.sessionId, "assistant", content, {
    intent: intent.intent,
    tasksCompleted: completed.length,
    tasksFailed: failed.length,
    durationMs: Date.now() - start,
  })

  return {
    content,
    tasks: [...completed, ...failed],
    toolCalls: ctx.toolCalls,
    thinking,
  }
}

// ========== Response Generation ==========

function generateResponseByRules(
  intent: ParsedIntent,
  completed: Task[],
  failed: Task[],
  ctx: AgentContext
): string {
  const matchTask = completed.find(t => t.id === "match")
  const matches = matchTask?.result as any[] | undefined

  switch (intent.intent) {
    case "match_jobs": {
      if (!matches || matches.length === 0) return "抱歉，没有找到匹配的岗位。请尝试上传简历或调整搜索条件。"
      const top = matches.slice(0, 5)
      let text = `为你找到 ${matches.length} 个匹配岗位，Top 5 如下：\n\n`
      for (const m of top) {
        const level = m.matchLevel === "excellent" ? "🌟高度匹配" : m.matchLevel === "good" ? "✅较好匹配" : m.matchLevel === "fair" ? "⚠️一般匹配" : "❌匹配度低"
        text += `${level} **${m.title}** @ ${m.company}\n`
        text += `  匹配度: ${m.score}% | 地点: ${m.location} | 薪资: ${m.salary}\n`
        if (m.matchedSkills?.length) text += `  已匹配技能: ${m.matchedSkills.slice(0, 5).join(", ")}${m.matchedSkills.length > 5 ? "..." : ""}\n`
        if (m.missingSkills?.length) text += `  缺失技能: ${m.missingSkills.slice(0, 3).join(", ")}${m.missingSkills.length > 3 ? "..." : ""}\n`
        text += `\n`
      }
      text += `💡 你可以说"帮我优化第1个岗位的简历"或"投递第2个岗位"`
      return text
    }

    case "optimize_resume": {
      const optTask = completed.find(t => t.id === "optimize")
      const report = optTask?.result as any
      if (report) {
        return `📊 简历优化报告（${report.overallScore}分）\n\n${report.overall}\n\n`
          + report.sections.map((s: any) => `**${s.icon} ${s.title}** (${s.score}分): ${s.feedback}\n建议: ${s.improvements.join("; ")}`).join("\n\n")
      }
      return "已收到优化请求。请先上传简历，或告诉我目标岗位的JD。"
    }

    case "apply_jobs": {
      const applyTask = completed.find(t => t.id === "apply")
      const applyResult = applyTask?.result as any
      if (applyResult?.success) {
        return `🎉 ${applyResult.message}\n\n你可以在「投递记录」中查看状态。`
      }
      return "投递操作失败。请先确保已完成岗位匹配。"
    }

    case "parse_resume": {
      if (ctx.resume) {
        return `✅ 简历解析完成\n\n👤 **${ctx.resume.name}**\n🎓 ${ctx.resume.education[0]?.school || ""} · ${ctx.resume.education[0]?.degree || ""}\n⚡ 技能: ${ctx.resume.skills.slice(0, 10).join(", ")}${ctx.resume.skills.length > 10 ? "..." : ""}\n💼 经历: ${ctx.resume.experience.length} 段\n🚀 项目: ${ctx.resume.projects.length} 个\n\n接下来可以「匹配岗位」或「针对JD优化」`
      }
      return "请上传简历或粘贴简历文本，我帮你解析。"
    }

    case "mock_interview":
      return "🎯 面试准备功能开发中... 你可以先告诉我目标岗位，我帮你分析面试重点。"

    case "career_advice":
      return "💼 职业建议：基于你的简历，我建议...\n\n（具体建议需要更多上下文，你可以告诉我感兴趣的方向）"

    default:
      return `我是Offer捕手求职Agent 🤖\n\n我可以帮你：\n1. 📄 解析简历并提取关键信息\n2. 🎯 智能匹配适合的岗位\n3. ✍️ 针对特定JD优化简历\n4. 🚀 一键模拟投递\n5. 💬 职业规划和面试建议\n\n请先上传简历或告诉我你的需求！`
  }
}
