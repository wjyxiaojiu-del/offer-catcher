// ============================================================
// Resume <-> DB mapping (single source of truth)
// ============================================================
// The DB record (Resume + educations/experiences/projects/skills relations)
// was being hand-mapped to ParsedResume in 6 routes and back to Prisma
// create-data in 3. These helpers collapse that duplication so the
// techStack JSON.parse / null-coalescing rules live in one place.

import type { ParsedResume, Education, Experience, Project } from "@/types"

// Shape of a Prisma Resume row with its relations included. Kept structural
// (not importing Prisma's generated type) so callers stay decoupled.
interface DbResumeRecord {
  id: string
  name: string
  email: string
  phone: string
  rawText: string
  source: string
  summary: string | null
  educations: {
    school: string; major: string; degree: string; year: string
    startYear?: string | null; endYear?: string | null; gpa?: string | null
  }[]
  experiences: {
    company: string; title: string; duration: string; description: string
    startDate?: string | null; endDate?: string | null
  }[]
  projects: { name: string; description: string; techStack: string }[]
  skills: { name: string }[]
}

function safeParseTechStack(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || "[]")
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Map a DB Resume record (with relations) to the ParsedResume API shape. */
export function dbResumeToParsed(record: DbResumeRecord): ParsedResume {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    phone: record.phone,
    rawText: record.rawText,
    source: record.source === "ai" ? "ai" : "rule",
    summary: record.summary || undefined,
    skills: record.skills.map((s) => s.name),
    skillGrades: [],
    education: record.educations.map((e) => ({
      school: e.school,
      major: e.major,
      degree: e.degree,
      year: e.year,
      startYear: e.startYear || undefined,
      endYear: e.endYear || undefined,
      gpa: e.gpa || undefined,
    })),
    experience: record.experiences.map((e) => ({
      company: e.company,
      title: e.title,
      duration: e.duration,
      description: e.description,
      startDate: e.startDate || undefined,
      endDate: e.endDate || undefined,
    })),
    projects: record.projects.map((p) => ({
      name: p.name,
      description: p.description,
      techStack: safeParseTechStack(p.techStack),
    })),
  }
}

/**
 * Build the nested `data` payload for prisma.resume.create or .update from
 * a ParsedResume. Pass `forUpdate: true` to add `deleteMany: {}` to each
 * relation so existing children are wiped before re-create.
 */
export function buildResumeWriteData(
  resume: ParsedResume,
  opts: { forUpdate?: boolean; userId?: string } = {}
) {
  const wrap = <T,>(create: T) =>
    opts.forUpdate ? { deleteMany: {}, create } : { create }

  return {
    name: resume.name,
    email: resume.email,
    phone: resume.phone,
    rawText: resume.rawText,
    source: resume.source || "rule",
    summary: resume.summary || "",
    userId: opts.userId || undefined,
    educations: wrap(
      resume.education.map((e: Education) => ({
        school: e.school || "",
        major: e.major || "",
        degree: e.degree || "",
        year: e.year || "",
        startYear: e.startYear,
        endYear: e.endYear,
        gpa: e.gpa,
      }))
    ),
    experiences: wrap(
      resume.experience.map((e: Experience) => ({
        company: e.company || "",
        title: e.title || "",
        duration: e.duration || "",
        description: e.description || "",
        startDate: e.startDate,
        endDate: e.endDate,
      }))
    ),
    projects: wrap(
      resume.projects.map((p: Project) => ({
        name: p.name || "",
        description: p.description || "",
        techStack: JSON.stringify(p.techStack || []),
      }))
    ),
    skills: wrap(resume.skills.map((s: string) => ({ name: s }))),
  }
}
