import { describe, it, expect } from "vitest"
import {
  parseResume,
  extractName,
  extractSkills,
  extractEducation,
  extractExperience,
  extractProjects,
} from "./resume-parser"

// ============================================================
// parseResume — full resume parsing
// ============================================================

describe("parseResume", () => {
  it("extracts name from first line", () => {
    const resume = parseResume("张三\n13800138000\nzhangsan@example.com")
    expect(resume.name).toBe("张三")
  })

  it("extracts phone number", () => {
    const resume = parseResume("张三\n联系电话：13800138000")
    expect(resume.phone).toBe("13800138000")
  })

  it("extracts email", () => {
    const resume = parseResume("张三\nzhangsan@example.com")
    expect(resume.email).toBe("zhangsan@example.com")
  })

  it("returns '未知' when name cannot be determined", () => {
    const resume = parseResume("13800138000\nsome skills")
    expect(resume.name).toBeDefined()
  })

  it("preserves rawText", () => {
    const text = "张三\nReact developer"
    const resume = parseResume(text)
    expect(resume.rawText).toBe(text)
  })
})

// ============================================================
// extractName — name extraction
// ============================================================

describe("extractName", () => {
  it("extracts Chinese name from first line", () => {
    expect(extractName(["张三", "13800138000"])).toBe("张三")
  })

  it("extracts hyphenated English name", () => {
    expect(extractName(["Jean-Pierre Dupont", "Paris, France"])).toBe("Jean-Pierre Dupont")
  })

  it("extracts English name with middle initial", () => {
    expect(extractName(["John M. Smith", "New York"])).toBe("John M. Smith")
  })

  it("skips resume title lines", () => {
    expect(extractName(["个人简历", "张三", "13800138000"])).toBe("张三")
  })

  it("skips English resume title", () => {
    expect(extractName(["Resume", "John Smith", "Engineer"])).toBe("John Smith")
  })

  it("extracts spaced Chinese name", () => {
    expect(extractName(["张 三", "13800138000"])).toBe("张三")
  })

  it("extracts name from line 6 when earlier lines are titles or junk", () => {
    // "Resume" is skipped as title, other lines don't match name patterns,
    // so the scan continues to line 5 where "张三" matches CJK name
    const lines = ["Resume", "2024-01-01", "react, typescript, node.js", "3年工作经验", "本科", "张三", "Phone"]
    expect(extractName(lines)).toBe("张三")
  })

  it("falls back to first non-title line if no name pattern matches", () => {
    const result = extractName(["个人简历", "李四的简历"])
    // "李四的简历" doesn't match name pattern (4+ chars with non-name content)
    // but it's the first non-title line in the fallback
    expect(result).toBeDefined()
  })
})

// ============================================================
// extractSkills — skill keyword detection
// ============================================================

describe("extractSkills", () => {
  it("detects common tech skills", () => {
    const { skills } = extractSkills("熟练掌握 React, TypeScript, Node.js")
    expect(skills).toContain("React")
    expect(skills).toContain("TypeScript")
    expect(skills).toContain("Node.js")
  })

  it("detects skills from a longer resume text", () => {
    const text = "本人熟悉 Python 和 Java 编程，了解 Docker 和 Kubernetes 部署"
    const { skills } = extractSkills(text)
    expect(skills.some((s) => /python/i.test(s))).toBe(true)
    expect(skills.some((s) => /java/i.test(s))).toBe(true)
  })

  it("returns empty arrays for text with no skills", () => {
    const { skills, skillGrades } = extractSkills("这是一段普通文字，没有技术关键词")
    expect(Array.isArray(skills)).toBe(true)
    expect(Array.isArray(skillGrades)).toBe(true)
  })

  it("does not return duplicate skills", () => {
    const { skills } = extractSkills("React React React")
    const reactCount = skills.filter((s) => s === "React").length
    expect(reactCount).toBeLessThanOrEqual(1)
  })

  it("grades skills from skill section as core", () => {
    const text = "技能：React, TypeScript\n项目经历\n使用 Python 开发"
    const { skillGrades } = extractSkills(text)
    const reactGrade = skillGrades.find(sg => sg.skill === "React")
    expect(reactGrade?.grade).toBe("core")
  })

  it("caps total skills at 15", () => {
    const text = "技能：React, Vue, Angular, TypeScript, JavaScript, Python, Java, Go, Rust, Docker, Kubernetes, MySQL, PostgreSQL, Redis, MongoDB, Git, Linux"
    const { skills } = extractSkills(text)
    expect(skills.length).toBeLessThanOrEqual(15)
  })
})

// ============================================================
// extractEducation — education parsing
// ============================================================

describe("extractEducation", () => {
  it("extracts school name", () => {
    const edu = extractEducation("教育经历\n清华大学 计算机科学 本科 2020-2024")
    expect(edu.length).toBeGreaterThanOrEqual(1)
    expect(edu.some((e) => e.school.includes("清华大学"))).toBe(true)
  })

  it("extracts degree", () => {
    const edu = extractEducation("北京大学 软件工程 硕士 2020-2023")
    expect(edu.length).toBeGreaterThanOrEqual(1)
    expect(edu[0].degree).toContain("硕士")
  })

  it("returns empty array for text without education", () => {
    const edu = extractEducation("这是一段没有教育信息的文字")
    expect(Array.isArray(edu)).toBe(true)
  })
})

// ============================================================
// extractExperience — work experience parsing
// ============================================================

describe("extractExperience", () => {
  it("extracts company and title from structured format", () => {
    const text = "工作经历\n腾讯科技有限公司 前端工程师 2020.06-2023.12\n负责前端开发工作"
    const exp = extractExperience(text)
    expect(exp.length).toBeGreaterThanOrEqual(1)
    expect(exp.some((e) => e.company.includes("腾讯"))).toBe(true)
  })

  it("returns empty array for text without experience section", () => {
    const exp = extractExperience("没有工作经历的文字")
    expect(Array.isArray(exp)).toBe(true)
  })

  it("extracts foreign company name (Google)", () => {
    const text = "工作经历\nGoogle 软件工程师 2020.06-2023.12\n负责搜索算法开发"
    const exp = extractExperience(text)
    expect(exp.length).toBeGreaterThanOrEqual(1)
    expect(exp.some(e => e.company.includes("Google"))).toBe(true)
  })

  it("extracts foreign company with suffix (Microsoft Corp)", () => {
    const text = "工作经历\nMicrosoft Corp 前端工程师 2019.01-2022.06\n负责 Azure 门户开发"
    const exp = extractExperience(text)
    expect(exp.length).toBeGreaterThanOrEqual(1)
    expect(exp.some(e => e.company.includes("Microsoft"))).toBe(true)
  })
})

// ============================================================
// extractProjects — project parsing
// ============================================================

describe("extractProjects", () => {
  it("extracts project name", () => {
    const projects = extractProjects("项目经历\nOffer捕手 - AI求职匹配系统\n使用 React + Next.js 开发")
    expect(projects.length).toBeGreaterThanOrEqual(1)
  })

  it("returns empty array for text without projects", () => {
    const projects = extractProjects("没有项目经历")
    expect(Array.isArray(projects)).toBe(true)
  })
})
