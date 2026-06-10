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
import { REACT_SYSTEM_PROMPT } from "./prompts"
import { callLLM, sanitizeJSON, extractJSON } from "@/lib/ai"
import { jobs } from "@/data/jobs"

// ========== Intent Recognition ==========

function recognizeIntentByRules(userInput: string, ctx: AgentContext): ParsedIntent {
  const lower = userInput.toLowerCase()

  // Fast rule-based intent detection (no LLM call for common patterns)
  // 匹配岗位 - 覆盖更多口语化表达
  if (/匹配|推荐|找.*工作|适合.*岗位|帮我找|有没有合适的|看看岗位|能做什么工作|我想找工作|岗位推荐|有.*岗位|什么.*工作/.test(lower)) {
    const tags: string[] = []
    // 扩充标签词表，与 jobs.ts 中的 tags 对齐
    if (/前端|react|vue|css|html|angular|svelte|nextjs|nuxt/.test(lower)) tags.push("前端")
    if (/后端|java|go|python|node|spring|django|flask|express|nestjs/.test(lower)) tags.push("后端")
    if (/ai|算法|大模型|nlp|cv|机器学习|深度学习|人工智能|llm|gpt/.test(lower)) tags.push("AI")
    if (/产品|pm|原型|需求|产品经理/.test(lower)) tags.push("产品")
    if (/数据|分析|sql|可视化|数据分析师|bi|etl/.test(lower)) tags.push("数据")
    if (/测试|qa|自动化测试|性能测试|测试工程师/.test(lower)) tags.push("测试")
    if (/运维|devops|sre|k8s|docker|部署/.test(lower)) tags.push("运维")
    if (/安全|网安|渗透|安全工程师/.test(lower)) tags.push("安全")
    if (/移动端|ios|android|flutter|react native|小程序/.test(lower)) tags.push("移动端")
    if (/全栈|fullstack|full-stack/.test(lower)) tags.push("全栈")
    if (/设计|ui|ux|交互|设计师/.test(lower)) tags.push("设计")
    return { intent: "match_jobs", params: { tags, query: userInput }, confidence: 0.9 }
  }

  // 优化简历 - 覆盖更多表达
  if (/优化|修改|改进|怎么改|建议|简历怎么写|简历帮我看看|简历有问题|怎么提升|简历.*改|改.*简历|看看.*简历/.test(lower)) {
    return { intent: "optimize_resume", params: { query: userInput }, confidence: 0.85 }
  }

  // 解析简历 - 覆盖更多表达
  if (/解析|提取|识别|上传.*简历|这是我的简历|帮我看看简历|简历分析|分析.*简历|简历.*解析/.test(lower)) {
    return { intent: "parse_resume", params: { query: userInput }, confidence: 0.9 }
  }

  // 投递岗位 - 覆盖更多表达
  if (/投递|申请|发送|一键投递|我要投|申请这个|帮我发|投.*岗位|申请.*岗位/.test(lower)) {
    return { intent: "apply_jobs", params: { query: userInput }, confidence: 0.85 }
  }

  // 模拟面试 - 覆盖更多表达
  if (/面试|准备|题库|面经|会问什么|结束面试|模拟面试|面试练习|考考我|面试题|面试.*准备|准备.*面试/.test(lower)) {
    return { intent: "mock_interview", params: { query: userInput }, confidence: 0.8 }
  }

  // 职业规划 - 覆盖更多表达
  if (/职业|规划|发展|转行|方向|前景|出路|未来怎么走|能往哪发展|职业.*建议| career/.test(lower)) {
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

// ========== ReAct Loop ==========

const MAX_REACT_ITERATIONS = 3

interface ReActOutput {
  thought: string
  action: { tool: string; params: Record<string, unknown> }
  finish: boolean
}

function buildReActUserPrompt(
  intent: ParsedIntent,
  ctx: AgentContext,
  steps: ReActStep[],
  availableTools: string[]
): string {
  const hasResume = !!ctx.resume
  const prevObservations = steps.length > 0
    ? steps.map((s, i) =>
        `Step ${i + 1}:\nThought: ${s.thought}\nAction: ${s.action?.tool || "none"}\nObservation: ${s.observation || "none"}`
      ).join("\n\n")
    : "（尚无执行步骤）"

  return `用户意图: ${intent.intent}
用户输入: ${intent.params.query || ""}
是否已解析简历: ${hasResume ? "是" : "否"}
${hasResume ? `简历姓名: ${ctx.resume!.name}, 技能: ${ctx.resume!.skills.slice(0, 5).join(", ")}` : ""}

可用工具: ${availableTools.join(", ")}

历史执行记录:
${prevObservations}

请决定下一步行动（输出 JSON）。`
}

export function parseReActResponse(text: string): ReActOutput | null {
  try {
    const json = JSON.parse(sanitizeJSON(extractJSON(text)))
    if (!json.thought || !json.action || !json.action.tool) {
      return null
    }
    return {
      thought: String(json.thought),
      action: {
        tool: String(json.action.tool),
        params: (json.action.params as Record<string, unknown>) || {},
      },
      finish: Boolean(json.finish) || json.action.tool === "finish",
    }
  } catch {
    return null
  }
}

async function executeReActAction(
  action: ReActOutput["action"],
  ctx: AgentContext,
  registry: Record<string, import("./types").Tool>
): Promise<{ result: unknown; error?: string; durationMs: number }> {
  const tool = registry[action.tool]
  if (!tool) {
    return { result: null, error: `未知工具: ${action.tool}`, durationMs: 0 }
  }

  const start = Date.now()
  try {
    const result = await tool.execute(action.params)
    return { result, durationMs: Date.now() - start }
  } catch (err: any) {
    return { result: null, error: err.message || String(err), durationMs: Date.now() - start }
  }
}

/**
 * Run ReAct loop: iterative thought → action → observation.
 * Falls back silently if LLM fails to produce valid actions.
 */
async function runReActLoop(
  intent: ParsedIntent,
  ctx: AgentContext,
  maxIterations = MAX_REACT_ITERATIONS
): Promise<{ steps: ReActStep[]; completed: Task[]; failed: Task[] }> {
  const registry = createToolRegistry(ctx)
  const availableTools = Object.keys(registry).concat("finish")
  const steps: ReActStep[] = []
  const completed: Task[] = []
  const failed: Task[] = []

  for (let i = 0; i < maxIterations; i++) {
    const userPrompt = buildReActUserPrompt(intent, ctx, steps, availableTools)

    let output: ReActOutput | null = null
    try {
      const llmText = await withTimeout(
        callLLM(REACT_SYSTEM_PROMPT, userPrompt),
        5000,
        null,
        { silent: true }
      )
      if (llmText) {
        output = parseReActResponse(llmText)
      }
    } catch {
      // LLM call failed, break to fallback
      break
    }

    if (!output) {
      break
    }

    if (output.finish || output.action.tool === "finish") {
      steps.push({ step: i + 1, thought: output.thought })
      break
    }

    // Execute action
    const execResult = await executeReActAction(output.action, ctx, registry)

    // Record tool call
    const toolCall: ToolCall = {
      tool: output.action.tool,
      params: output.action.params,
      result: execResult.result,
      error: execResult.error,
      durationMs: execResult.durationMs,
    }
    ctx.toolCalls.push(toolCall)

    steps.push({
      step: i + 1,
      thought: output.thought,
      action: toolCall,
      observation: execResult.error
        ? `执行失败: ${execResult.error}`
        : `执行成功: ${JSON.stringify(execResult.result).slice(0, 300)}`,
    })

    // Convert to Task for backward compatibility
    const task: Task = {
      id: `react-${i + 1}`,
      name: output.action.tool,
      description: output.thought,
      status: execResult.error ? "failed" : "completed",
      agent: output.action.tool,
      dependencies: [],
      params: output.action.params,
      result: execResult.result,
      error: execResult.error,
      startTime: Date.now() - execResult.durationMs,
      endTime: Date.now(),
    }
    if (execResult.error) {
      failed.push(task)
    } else {
      completed.push(task)
    }
  }

  return { steps, completed, failed }
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

  // Step 3: Execute via ReAct loop (LLM) or fixed DAG (rules)
  const useLLM = process.env.DISABLE_LLM_PLANNER !== "true"
  let completed: Task[] = []
  let failed: Task[] = []
  let reactSteps: ReActStep[] = []

  if (useLLM) {
    thinking.push("🔄 ReAct 循环启动...")
    const reactResult = await runReActLoop(intent, ctx)
    if (reactResult.steps.length > 0) {
      reactSteps = reactResult.steps
      completed = reactResult.completed
      failed = reactResult.failed
      for (const s of reactSteps) {
        thinking.push(`Step ${s.step}: 💭 ${s.thought}`)
        if (s.action) {
          thinking.push(`  → 🔧 ${s.action.tool} ${s.action.error ? "❌" : "✅"}`)
        }
        if (s.observation) {
          thinking.push(`  ← 📊 ${s.observation.slice(0, 120)}`)
        }
      }
      if (reactSteps[reactSteps.length - 1]?.action?.tool !== "finish") {
        thinking.push("⏹️ ReAct 达到最大迭代次数")
      }
    } else {
      thinking.push("⚠️ ReAct 循环未产生有效步骤，回退到固定 DAG")
    }
  }

  // Fallback to fixed DAG if ReAct produced nothing
  if (completed.length === 0 && failed.length === 0) {
    let tasks: Task[] = []
    if (useLLM) {
      const llmTasks = await planTasksByLLM(intent, ctx)
      if (llmTasks && llmTasks.length > 0) {
        tasks = llmTasks
        thinking.push("✅ LLM 规划完成")
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
    thinking.push("🚀 正在执行...")
    const result = await executeTasks(tasks, ctx)
    completed = result.completed
    failed = result.failed
  }

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
    reactSteps: reactSteps.length > 0 ? reactSteps : undefined,
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
      // 检查是否有解析简历失败的情况
      const parseTask = failed.find(t => t.id === "parse")
      if (parseTask) {
        return "📄 **请先上传简历**\n\n我需要先了解你的技能和经历，才能为你匹配合适的岗位。\n\n你可以：\n1. 直接粘贴简历文本\n2. 上传 PDF/DOCX 简历文件\n\n上传后我会自动为你匹配岗位！"
      }
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

    case "mock_interview": {
      const interviewTask = completed.find(t => t.id === "prep")
      const interviewResult = interviewTask?.result as any
      if (interviewResult?.question) {
        const typeLabel = interviewResult.interviewType === "technical" ? "技术面试" : interviewResult.interviewType === "behavioral" ? "行为面试" : "综合面试"
        let text = `🎯 **${typeLabel}** — 第 ${interviewResult.questionNumber} 题\n\n`
        text += `> ${interviewResult.question}\n\n`
        text += `请回答这个问题，我会根据你的回答追问或提出下一题。\n`
        text += `💡 说"结束面试"可以随时停止并获得总结。`
        return text
      }
      return "🎯 面试准备中... 请先上传简历或告诉我目标岗位。"
    }

    case "career_advice": {
      const careerTask = completed.find(t => t.id === "advise")
      const careerResult = careerTask?.result as any
      if (careerResult?.advice) {
        let text = `💼 **职业规划建议**\n\n${careerResult.advice}\n`
        if (careerResult.gapAnalysis) {
          text += `\n📊 **技能差距分析**\n`
          if (careerResult.gapAnalysis.matched?.length) text += `✅ 已掌握: ${careerResult.gapAnalysis.matched.join(", ")}\n`
          if (careerResult.gapAnalysis.missing?.length) text += `❌ 待学习: ${careerResult.gapAnalysis.missing.join(", ")}\n`
          if (careerResult.gapAnalysis.priority?.length) text += `🔥 优先级: ${careerResult.gapAnalysis.priority.join(" > ")}\n`
        }
        return text
      }
      return "💼 职业建议生成中... 请先上传简历。"
    }

    default:
      return `我是Offer捕手求职Agent 🤖\n\n我可以帮你：\n1. 📄 解析简历并提取关键信息\n2. 🎯 智能匹配适合的岗位\n3. ✍️ 针对特定JD优化简历\n4. 🚀 一键模拟投递\n5. 💬 职业规划和面试建议\n\n请先上传简历或告诉我你的需求！`
  }
}
