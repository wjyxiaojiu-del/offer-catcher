// ============================================================
// LLM Task Planner — Dynamic task DAG generation
// ============================================================

import type { ParsedIntent, AgentContext, Task } from "./types"
import { PLANNER_SYSTEM_PROMPT } from "./prompts"
import { callLLM } from "@/lib/ai"
import { withTimeout } from "@/lib/utils"

interface LLMTaskPlan {
  tasks: Array<{
    id: string
    name: string
    agent: string
    description: string
    dependencies?: string[]
  }>
}

function buildPlannerUserPrompt(
  intent: ParsedIntent,
  ctx: AgentContext
): string {
  const hasResume = !!ctx.resume
  const lastIntent = ctx.memory.shortTerm["last_intent"] as string | undefined

  return `用户意图: ${intent.intent} (置信度: ${Math.round(intent.confidence * 100)}%)
用户输入: ${intent.params.query || ""}
是否已解析简历: ${hasResume ? "是" : "否"}
${hasResume ? `简历姓名: ${ctx.resume!.name}, 技能: ${ctx.resume!.skills.slice(0, 5).join(", ")}${ctx.resume!.skills.length > 5 ? "..." : ""}` : ""}
${lastIntent ? `上一轮意图: ${lastIntent}` : ""}

请输出任务执行计划（纯JSON）。`
}

function sanitizePlannerJSON(text: string): string {
  let s = text.trim()
  // Remove markdown fences
  s = s.replace(/^```json\s*/, "").replace(/^```/, "").replace(/```$/, "").trim()
  // Extract JSON object
  const match = s.match(/\{[\s\S]*\}/)
  return match ? match[0] : s
}

export async function planTasksByLLM(
  intent: ParsedIntent,
  ctx: AgentContext
): Promise<Task[] | null> {
  try {
    const userPrompt = buildPlannerUserPrompt(intent, ctx)
    const result = await withTimeout(
      callLLM(PLANNER_SYSTEM_PROMPT, userPrompt),
      4000,
      null,
      { silent: true }
    )
    if (!result) return null

    const plan: LLMTaskPlan = JSON.parse(sanitizePlannerJSON(result))
    if (!plan.tasks || !Array.isArray(plan.tasks) || plan.tasks.length === 0) {
      return null
    }

    // Validate and normalize
    const tasks: Task[] = plan.tasks.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description || "",
      status: "pending",
      agent: t.agent,
      dependencies: t.dependencies || [],
    }))

    // Validate agent names against known types
    const validAgents = new Set([
      "resumeParser",
      "matcher",
      "analyzer",
      "advisor",
      "applier",
      "synthesizer",
    ])
    for (const t of tasks) {
      if (!validAgents.has(t.agent)) {
        console.warn("LLM planner returned unknown agent:", t.agent, "-> mapping to synthesizer")
        t.agent = "synthesizer"
      }
    }

    return tasks
  } catch (err) {
    console.warn("LLM task planning failed:", err)
    return null
  }
}
