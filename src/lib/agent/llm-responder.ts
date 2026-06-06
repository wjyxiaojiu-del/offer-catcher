// ============================================================
// LLM Responder — Dynamic natural language response generation
// ============================================================

import type { ParsedIntent, AgentContext, Task } from "./types"
import { RESPONDER_SYSTEM_PROMPT } from "./prompts"
import { callLLM } from "@/lib/ai"
import { withTimeout } from "@/lib/utils"

function buildResponderUserPrompt(
  intent: ParsedIntent,
  completed: Task[],
  failed: Task[],
  ctx: AgentContext
): string {
  const userInput = (intent.params.query as string) || ""

  const taskResults = completed.map((t) => ({
    id: t.id,
    name: t.name,
    agent: t.agent,
    status: t.status,
    result: t.result ? JSON.stringify(t.result).slice(0, 800) : null,
  }))

  const failedTasks = failed.map((t) => ({
    id: t.id,
    name: t.name,
    error: t.error,
  }))

  return `意图: ${intent.intent}
用户输入: ${userInput}
${ctx.resume ? `候选人: ${ctx.resume.name}, 技能: ${ctx.resume.skills.slice(0, 8).join(", ")}` : ""}

已完成的任务:
${JSON.stringify(taskResults, null, 2)}

失败的任务:
${JSON.stringify(failedTasks, null, 2)}

请生成对用户的回复。`
}

export async function generateResponseByLLM(
  intent: ParsedIntent,
  completed: Task[],
  failed: Task[],
  ctx: AgentContext
): Promise<string | null> {
  try {
    const userPrompt = buildResponderUserPrompt(intent, completed, failed, ctx)
    const result = await withTimeout(
      callLLM(RESPONDER_SYSTEM_PROMPT, userPrompt),
      5000,
      null,
      { silent: true }
    )
    if (!result || !result.trim()) return null
    return result.trim()
  } catch (err) {
    console.warn("LLM response generation failed:", err)
    return null
  }
}
