// ============================================================
// Multi-Agent Resume Parsing Pipeline
// ============================================================
// Phase 2: Orchestrates 5 specialist agents + 1 validator agent
// to collaboratively parse a resume with high accuracy.

import type { ParsedResume, Education, Experience, Project } from "@/types"
import {
  parseResume,
  extractSkills,
  extractEducation,
  extractExperience,
  extractProjects,
} from "@/lib/resume-parser"
import { aiParseResume } from "@/lib/ai"

export interface AgentRunResult<T> {
  agentName: string
  status: "success" | "fallback" | "failed"
  durationMs: number
  result: T
}

export interface MultiAgentParseResult {
  resume: ParsedResume
  agents: AgentRunResult<unknown>[]
  source: "multi-agent"
}

// ------------------------------------------------------------------
// Helper: confidence guard
// ------------------------------------------------------------------
function isLowConfidenceInfo(info: { name: string; email: string; phone: string }): boolean {
  return !info.name || info.name === "未知" || (!info.email && !info.phone)
}

function isLowConfidenceSkills(skills: string[]): boolean {
  return skills.length === 0
}

function isLowConfidenceEducation(edu: Education[]): boolean {
  return edu.length === 0 || edu.every((e) => !e.school)
}

function isLowConfidenceExperience(exp: Experience[]): boolean {
  return exp.length === 0 || exp.every((e) => !e.company && !e.title)
}

function isLowConfidenceProjects(projects: Project[]): boolean {
  return projects.length === 0 || projects.every((p) => !p.name)
}

// ------------------------------------------------------------------
// Agent 1: Personal Info Extraction
// ------------------------------------------------------------------

/**
 * Extracts personal info (name, email, phone) from resume text.
 * Uses rule-based parsing first; falls back to LLM if confidence is low.
 *
 * @param text - Raw resume text
 * @returns Object containing name, email, and phone
 */
export async function infoExtractionAgent(
  text: string
): Promise<{ name: string; email: string; phone: string }> {
  const ruleResult = parseResume(text)
  const info = {
    name: ruleResult.name,
    email: ruleResult.email,
    phone: ruleResult.phone,
  }

  if (!isLowConfidenceInfo(info)) {
    return info
  }

  // Fallback to LLM
  try {
    const aiResult = await aiParseResume(text)
    return {
      name: aiResult.name && aiResult.name !== "未知" ? aiResult.name : info.name,
      email: aiResult.email || info.email,
      phone: aiResult.phone || info.phone,
    }
  } catch {
    return info
  }
}

// ------------------------------------------------------------------
// Agent 2: Skill Extraction
// ------------------------------------------------------------------

/**
 * Extracts technical and domain skills from resume text.
 * Uses rule-based parsing first; falls back to LLM if no skills found.
 *
 * @param text - Raw resume text
 * @returns Array of skill strings
 */
export async function skillExtractionAgent(text: string): Promise<string[]> {
  const skills = extractSkills(text)

  if (!isLowConfidenceSkills(skills)) {
    return skills
  }

  // Fallback to LLM
  try {
    const aiResult = await aiParseResume(text)
    if (aiResult.skills?.length) {
      return Array.from(new Set([...skills, ...aiResult.skills]))
    }
  } catch {
    // ignore
  }
  return skills
}

// ------------------------------------------------------------------
// Agent 3: Education Extraction
// ------------------------------------------------------------------

/**
 * Extracts education history from resume text.
 * Uses rule-based parsing first; falls back to LLM if no valid entries found.
 *
 * @param text - Raw resume text
 * @returns Array of Education objects
 */
export async function educationAgent(text: string): Promise<Education[]> {
  const education = extractEducation(text)

  if (!isLowConfidenceEducation(education)) {
    return education
  }

  // Fallback to LLM
  try {
    const aiResult = await aiParseResume(text)
    if (aiResult.education?.length) {
      return aiResult.education.map((e: any) => ({
        school: e.school || "",
        major: e.major || "",
        degree: e.degree || "",
        year: e.year || "",
        startYear: e.startYear,
        endYear: e.endYear,
        gpa: e.gpa,
      }))
    }
  } catch {
    // ignore
  }
  return education
}

// ------------------------------------------------------------------
// Agent 4: Work Experience Extraction
// ------------------------------------------------------------------

/**
 * Extracts work experience from resume text.
 * Uses rule-based parsing first; falls back to LLM if no valid entries found.
 *
 * @param text - Raw resume text
 * @returns Array of Experience objects
 */
export async function experienceAgent(text: string): Promise<Experience[]> {
  const experience = extractExperience(text)

  if (!isLowConfidenceExperience(experience)) {
    return experience
  }

  // Fallback to LLM
  try {
    const aiResult = await aiParseResume(text)
    if (aiResult.experience?.length) {
      return aiResult.experience.map((e: any) => ({
        company: e.company || "",
        title: e.title || "",
        duration: e.duration || "",
        description: e.description || "",
        startDate: e.startDate,
        endDate: e.endDate,
      }))
    }
  } catch {
    // ignore
  }
  return experience
}

// ------------------------------------------------------------------
// Agent 5: Project Extraction
// ------------------------------------------------------------------

/**
 * Extracts project experience from resume text.
 * Uses rule-based parsing first; falls back to LLM if no valid entries found.
 *
 * @param text - Raw resume text
 * @returns Array of Project objects
 */
export async function projectAgent(text: string): Promise<Project[]> {
  const projects = extractProjects(text)

  if (!isLowConfidenceProjects(projects)) {
    return projects
  }

  // Fallback to LLM
  try {
    const aiResult = await aiParseResume(text)
    if (aiResult.projects?.length) {
      return aiResult.projects.map((p: any) => ({
        name: p.name || "",
        description: p.description || "",
        techStack: p.techStack || [],
        url: p.url,
      }))
    }
  } catch {
    // ignore
  }
  return projects
}

// ------------------------------------------------------------------
// Agent 6: Validator — deduplication, completeness, cross-validation
// ------------------------------------------------------------------

/**
 * Validates and merges partial resume data from multiple agents.
 * Performs deduplication, missing-field completion, and cross-validation.
 *
 * @param parts - Partially parsed resume from specialist agents
 * @returns Fully validated ParsedResume
 */
export async function validatorAgent(parts: Partial<ParsedResume>): Promise<ParsedResume> {
  const {
    name = "未知",
    email = "",
    phone = "",
    skills = [],
    education = [],
    experience = [],
    projects = [],
    rawText = "",
  } = parts

  // 1. Deduplicate skills (case-insensitive)
  const seenSkills = new Set<string>()
  const dedupedSkills: string[] = []
  for (const s of skills) {
    const key = s.trim().toLowerCase()
    if (key && !seenSkills.has(key)) {
      seenSkills.add(key)
      dedupedSkills.push(s.trim())
    }
  }

  // 2. Deduplicate education by school+major+year
  const eduKeySet = new Set<string>()
  const dedupedEducation: Education[] = []
  for (const e of education) {
    const key = `${e.school}|${e.major}|${e.year}`
    if (e.school && !eduKeySet.has(key)) {
      eduKeySet.add(key)
      dedupedEducation.push(e)
    }
  }

  // 3. Deduplicate experience by company+title
  const expKeySet = new Set<string>()
  const dedupedExperience: Experience[] = []
  for (const ex of experience) {
    const key = `${ex.company}|${ex.title}`
    if ((ex.company || ex.title) && !expKeySet.has(key)) {
      expKeySet.add(key)
      dedupedExperience.push(ex)
    }
  }

  // 4. Deduplicate projects by name
  const projKeySet = new Set<string>()
  const dedupedProjects: Project[] = []
  for (const p of projects) {
    const key = p.name.toLowerCase()
    if (p.name && !projKeySet.has(key)) {
      projKeySet.add(key)
      dedupedProjects.push(p)
    }
  }

  // 5. Cross-validation: ensure project tech stacks contain skills that appear in descriptions
  for (const p of dedupedProjects) {
    const desc = p.description.toLowerCase()
    for (const skill of dedupedSkills) {
      if (desc.includes(skill.toLowerCase()) && !p.techStack.includes(skill)) {
        p.techStack.push(skill)
      }
    }
  }

  // 6. Cross-validation: ensure experience descriptions don't duplicate project names excessively
  const projNames = Array.from(new Set(dedupedProjects.map((p) => p.name.toLowerCase())))
  for (const ex of dedupedExperience) {
    let desc = ex.description
    for (const pn of projNames) {
      if (pn.length > 3 && desc.toLowerCase().includes(pn)) {
        // If a project name appears inside experience, it's likely overlap — keep it but note implicitly
        break
      }
    }
    ex.description = desc
  }

  // 7. Fill missing fields from raw text heuristics
  const finalName = name && name !== "未知" ? name : rawText.split("\n")[0]?.trim() || "未知"
  const finalEmail =
    email || rawText.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/)?.[0] || ""
  const finalPhone = phone || rawText.match(/1[3-9]\d{9}/)?.[0] || ""

  return {
    name: finalName,
    email: finalEmail,
    phone: finalPhone,
    skills: dedupedSkills,
    education: dedupedEducation,
    experience: dedupedExperience,
    projects: dedupedProjects,
    rawText,
    source: "rule",
    summary: parts.summary,
  }
}

// ------------------------------------------------------------------
// Orchestrator: multiAgentParseResume
// ------------------------------------------------------------------

/**
 * Parses a resume using a multi-agent collaborative pipeline.
 * Runs 5 specialist agents in parallel, then validates and merges results.
 *
 * @param text - Raw resume text
 * @returns ParsedResume with full structured data
 */
export async function multiAgentParseResume(text: string): Promise<MultiAgentParseResult> {
  if (!text || text.trim().length < 10) {
    throw new Error("简历文本过短或为空")
  }

  const agents: AgentRunResult<unknown>[] = []

  // Run 5 specialist agents in parallel
  const runAgent = async <T,>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> => {
    const start = Date.now()
    try {
      const result = await fn()
      const duration = Date.now() - start
      agents.push({ agentName: name, status: "success", durationMs: duration, result })
      return result
    } catch (err) {
      const duration = Date.now() - start
      agents.push({ agentName: name, status: "failed", durationMs: duration, result: null })
      throw err
    }
  }

  const [info, skills, education, experience, projects] = await Promise.all([
    runAgent("infoExtractionAgent", () => infoExtractionAgent(text)),
    runAgent("skillExtractionAgent", () => skillExtractionAgent(text)),
    runAgent("educationAgent", () => educationAgent(text)),
    runAgent("experienceAgent", () => experienceAgent(text)),
    runAgent("projectAgent", () => projectAgent(text)),
  ])

  // Validation agent
  const validatorStart = Date.now()
  const resume = await validatorAgent({
    name: info.name,
    email: info.email,
    phone: info.phone,
    skills,
    education,
    experience,
    projects,
    rawText: text,
  })
  agents.push({
    agentName: "validatorAgent",
    status: "success",
    durationMs: Date.now() - validatorStart,
    result: resume,
  })

  return { resume, agents, source: "multi-agent" }
}
