// ============================================================
// Agent Memory — Session + User-level persistence
// ============================================================

import { prisma } from "@/lib/db"

// ========== Session Memory (short-term) ==========

export async function saveSessionMemory(
  sessionId: string,
  key: string,
  value: unknown
): Promise<void> {
  try {
    // NOTE: read-modify-write on the JSON blob. Two concurrent writes to the
    // same session can lose updates (last writer wins). Acceptable at current
    // single-user concurrency; revisit with a row lock or per-key column if
    // sessions are written concurrently.
    const existing = await prisma.agentSession.findUnique({ where: { sessionId } })
    const data = existing ? JSON.parse(existing.data || "{}") : {}
    data[key] = value
    await prisma.agentSession.upsert({
      where: { sessionId },
      create: { sessionId, data: JSON.stringify(data) },
      update: { data: JSON.stringify(data), updatedAt: new Date() },
    })
  } catch (err) {
    console.warn("Failed to save session memory:", err)
  }
}

export async function getSessionMemory(
  sessionId: string,
  key: string
): Promise<unknown> {
  try {
    const record = await prisma.agentSession.findUnique({ where: { sessionId } })
    if (!record) return undefined
    const data = JSON.parse(record.data || "{}")
    return data[key]
  } catch {
    return undefined
  }
}

export async function getAllSessionMemory(sessionId: string): Promise<Record<string, unknown>> {
  try {
    const record = await prisma.agentSession.findUnique({ where: { sessionId } })
    if (!record) return {}
    return JSON.parse(record.data || "{}")
  } catch {
    return {}
  }
}

// ========== User Preference (long-term) ==========

export async function saveUserPreference(
  userId: string,
  key: string,
  value: unknown
): Promise<void> {
  try {
    const existing = await prisma.userPreference.findUnique({
      where: { userId_key: { userId, key } },
    })
    if (existing) {
      await prisma.userPreference.update({
        where: { id: existing.id },
        data: { value: JSON.stringify(value) },
      })
    } else {
      await prisma.userPreference.create({
        data: { userId, key, value: JSON.stringify(value) },
      })
    }
  } catch (err) {
    console.warn("Failed to save user preference:", err)
  }
}

export async function getUserPreference(userId: string, key: string): Promise<unknown> {
  try {
    const record = await prisma.userPreference.findUnique({
      where: { userId_key: { userId, key } },
    })
    if (!record) return undefined
    return JSON.parse(record.value)
  } catch {
    return undefined
  }
}

export async function getAllUserPreferences(userId: string): Promise<Record<string, unknown>> {
  try {
    const records = await prisma.userPreference.findMany({ where: { userId } })
    const result: Record<string, unknown> = {}
    for (const r of records) {
      try { result[r.key] = JSON.parse(r.value) } catch { result[r.key] = r.value }
    }
    return result
  } catch {
    return {}
  }
}

// ========== Conversation History ==========

export async function saveMessage(
  sessionId: string,
  role: "user" | "assistant" | "system" | "tool",
  content: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    // Ensure the parent session row exists first. AgentMessage now relates
    // to AgentSession.sessionId, so a missing session would violate the FK
    // (and a pure chat turn may never have triggered saveSessionMemory).
    await prisma.agentSession.upsert({
      where: { sessionId },
      create: { sessionId },
      update: {},
    })
    await prisma.agentMessage.create({
      data: {
        sessionId,
        role,
        content,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    })
  } catch (err) {
    console.warn("Failed to save message:", err)
  }
}

export async function getConversationHistory(
  sessionId: string,
  limit: number = 20
): Promise<{ role: string; content: string; timestamp: Date }[]> {
  try {
    const records = await prisma.agentMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take: limit,
    })
    return records.reverse().map(r => ({
      role: r.role,
      content: r.content,
      timestamp: r.createdAt,
    }))
  } catch {
    return []
  }
}
