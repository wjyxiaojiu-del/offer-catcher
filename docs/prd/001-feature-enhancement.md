# PRD-001: Offer 捕手 — 现有功能增强

> 状态：Draft
> 创建日期：2026-06-07
> 作者：Claude Code (auto-generated)

---

## Problem Statement

作为求职学生用户，我在使用 Offer 捕手投递简历时发现以下问题：

1. **匹配分数不准** — "10-15年经验"的岗位被误判为应届生岗位，导致权重错误；任何含"University"的学校都获得加分；关键词匹配不分主次；项目评分只看数量不看质量。
2. **简历解析质量差** — 名字经常提取失败或取到标题行；技能词典太小漏掉很多技能；扫描件 PDF 无法解析；外企公司名识别不到。
3. **Agent 功能不完整** — 模拟面试和职业规划是占位文字；对话是固定流程不能根据中间结果调整；用户要等全部完成才能看到结果。
4. **测试覆盖不足** — 匹配算法的关键词/日期/权重、Agent 工具链、AI 函数均无测试，改代码缺乏安全网。

---

## Solution

分三个阶段迭代修复：

- **Phase 1 (P0 准确性)**：修复匹配算法 4 个 bug + 简历解析 2 个质量问题，确保投递时分数准确。
- **Phase 2 (P1 功能)**：补全 Agent 两大 stub 功能 + 升级 ReAct 架构 + 流式输出 + OCR + 外企识别。
- **Phase 3 (P2 测试)**：补齐高风险模块测试，达到 100+ 用例覆盖率。

---

## User Stories

### Phase 1: 准确性修复 (P0)

1. As a 求职学生, I want "10-15年经验"的岗位不被误判为应届生, so that 匹配权重正确反映岗位类型。
2. As a 求职学生, I want 学校层级加分只针对明确的 985/211 名单, so that 普通 "University" 不会获得虚假加分。
3. As a 求职学生, I want JD 中的核心技能词权重高于描述性废话词, so that 关键词匹配分数反映真实匹配度。
4. As a 求职学生, I want 项目评分考虑项目与岗位的相关性, so that 做了 3 个前端项目的人不会在后端岗位上获得高项目分。
5. As a 求职学生, I want 简历名字提取支持中间名和连字符, so that "Jean-Pierre Dupont" 和 "张 三" 都能正确提取。
6. As a 求职学生, I want 技能词典覆盖 200+ 技能术语, so that 我简历中的技能不会被遗漏。

### Phase 2: 功能补全 (P1)

7. As a 求职学生, I want 输入"帮我模拟面试"后获得真正的面试模拟, so that 我可以针对目标岗位练习面试。
8. As a 求职学生, I want 面试模拟自动判断技术面或行为面, so that 不同岗位获得不同类型的面试准备。
9. As a 求职学生, I want 面试模拟包含追问和评分, so that 我知道自己的回答质量和改进方向。
10. As a 求职学生, I want 输入"职业规划建议"后获得技能差距分析和学习路线, so that 我知道该学什么、怎么学。
11. As a 求职学生, I want 职业规划包含行业洞察和岗位推荐, so that 我了解目标行业的发展前景。
12. As a 求职学生, I want Agent 能根据工具返回结果动态调整下一步, so that 复杂任务不需要我手动拆解。
13. As a 求职学生, I want Agent 最多迭代 3 轮, so that LLM 调用成本可控。
14. As a 求职学生, I want 对话回复边生成边显示, so that 我不需要等待全部完成。
15. As a 求职学生, I want 扫描件 PDF 也能解析出文字, so that 我不需要手动转换格式。
16. As a 求职学生, I want 外企公司名（Google/Apple/Microsoft 等）能被正确识别, so that 外企工作经历不会被遗漏。

### Phase 3: 测试覆盖 (P2)

17. As a 开发者, I want 匹配算法的关键词匹配有测试覆盖, so that 改代码时不会破坏已有逻辑。
18. As a 开发者, I want 日期解析（含"至今/present"）有测试覆盖, so that 工作时长计算可验证。
19. As a 开发者, I want 动态权重策略有测试覆盖, so that AI/应届岗位的权重调整可验证。
20. As a 开发者, I want Agent 工具执行有测试覆盖, so that 工具行为变更可验证。
21. As a 开发者, I want 意图识别有测试覆盖, so that 新意图不破坏已有识别。
22. As a 开发者, I want AI 函数（解析/匹配/优化）有 mock 测试, so that 不依赖真实 LLM API。
23. As a 开发者, I want 测试总数达到 100+ 用例, so that 核心路径有充分的安全网。

---

## Implementation Decisions

### ID-1: Entry-level 误触发修复 (A1)

**问题**：`job.experience.includes("0-")` 会匹配到 "10-15年"。

**方案**：改用正则 `/^0-\d/` 或 `/^0[-~]/`，只匹配以 "0-" 开头的经验要求（如 "0-2年"、"0~3年"）。同时在 `job.experience` 字段上做 trim 处理。

**影响模块**：`src/lib/matcher.ts` → `matchResumeToJobs` 函数的动态权重逻辑。

### ID-2: 学校层级误加分修复 (A2)

**问题**：`school.includes("University")` 会让所有含 "University" 的学校都获得加分。

**方案**：
- 建立 985/211 明确名单（约 40 所 985 + 约 100 所 211）。
- 改为名单匹配而非子串匹配。
- 保留 "一本/重点" 的子串匹配作为 fallback（因为没有完整名单）。
- 名单数据放在 `src/data/universities.ts` 新文件中。

**影响模块**：`src/lib/matcher.ts` → `calculateEducationMatch` 函数。

### ID-3: 关键词权重区分 (A3)

**问题**：JD 描述中所有词权重相同（1x），核心技能词和废话词没有区分。

**方案**：
- `job.skills`（或 `requiredSkills`）中的词：权重 3x（当前 2x 提升）。
- `job.requirements` 中的词：权重 2x。
- `job.description` 中的词：权重 1x（当前不变）。
- 扩充停用词列表：增加 "相关"、"良好"、"较强"、"丰富"、"优秀"、"熟练掌握" 等。
- 关键词最低长度从 2 提升到 3（减少 "Go"、"C" 等单字母词的噪音）。

**影响模块**：`src/lib/matcher.ts` → `calculateKeywordMatch` 函数。

### ID-4: 项目评分升级 (A4)

**问题**：项目评分 = `min(projectCount * 30, 100)`，只看数量不看质量。

**方案**：
- 引入 **项目-岗位相关性**：计算项目 techStack 与岗位 skills 的重叠度。
- 单项目得分 = 基础分(20) + 相关性分(0-50) + 量化分(0-30)。
- 量化分：检测项目描述中的数字指标（如 "性能提升 50%"、"日活 10 万"）。
- 总分 = `min(sum(单项目得分), 100)`。

**影响模块**：`src/lib/matcher.ts` → `generateOptimizationReport` 函数的 "项目经历" 评分逻辑。

### ID-5: 名字提取增强 (C1)

**问题**：只看前 5 行，不支持中间名/连字符，回退取首行容易取到标题。

**方案**：
- 扫描范围从 5 行扩展到 10 行。
- 增加英文名字模式：支持 `First Middle Last`、`First M. Last`、`First-Middle Last`、`First Last-Surname`。
- 增加中文名字模式：支持 2-4 字中文名（含少数民族 4 字名）。
- 回退策略改进：跳过明显是标题的行（含 "简历"、"Resume"、"CV" 等关键词），取第一个非标题行。

**影响模块**：`src/lib/resume-parser.ts` → `extractName` 函数。

### ID-6: 技能词典扩充 (C2)

**问题**：硬编码 80 个技能词，新技能/行业术语检测不到。

**方案**：
- 从 80 扩到 200+，新增分类：
  - 前端补充：Svelte, Solid.js, Astro, Remix, Vite, pnpm, npm
  - 后端补充：Gin, Echo, Fiber, Actix, Axum, FastAPI, Flask, Laravel, Symfony
  - 数据库补充：ClickHouse, TiDB, CockroachDB, DynamoDB, Cassandra, Neo4j
  - AI/ML 补充：LangChain, LlamaIndex, vLLM, Ollama, Stable Diffusion, Midjourney, ComfyUI
  - 云原生补充：Kubernetes, Helm, Istio, ArgoCD, Grafana, Loki
  - 产品/设计：Figma, Sketch, Adobe XD, Axure, 墨刀
  - 数据分析：Power BI, Tableau, Superset, Metabase, dbt
  - 中文领域词：大前端, 微服务, 容器化, 持续集成, 持续部署, 数据仓库, 数据治理
- 放在 `src/lib/resume-parser.ts` 的 `SKILL_DICT` 数组中（不改结构）。

**影响模块**：`src/lib/resume-parser.ts` → `SKILL_DICT` 常量。

### ID-7: Mock Interview 补全 (B1)

**问题**：`advisor` 工具的 `interview` subtype 返回占位文字。

**方案**：
- 新增 `src/lib/agent/interview.ts` 模块。
- 面试流程：`生成题目 → 用户回答 → 追问/评分 → 总结`。
- 根据 JD 自动判断类型：
  - 技术岗（含编程/框架/系统设计关键词）→ 技术面试
  - 非技术岗 → 行为面试
  - 混合岗 → 两者兼顾
- 技术面试：算法题 + 系统设计 + 项目深挖 + 技术概念。
- 行为面试：STAR 法则引导 + 自我介绍 + 优缺点 + 职业规划。
- 每题评分维度：内容完整性、逻辑清晰度、专业深度。
- 面试结果写入 session memory。

**新增文件**：`src/lib/agent/interview.ts`
**修改文件**：`src/lib/agent/tools.ts`（advisor 工具增加 interview 逻辑）

### ID-8: Career Advice 补全 (B2)

**问题**：`advisor` 工具的 `career` subtype 返回占位文字。

**方案**：
- 新增 `src/lib/agent/career.ts` 模块。
- 三大模块：
  1. **技能差距分析**：对比简历技能 vs 目标岗位技能，生成差距清单 + 优先级排序。
  2. **学习路线图**：针对每个差距项，推荐学习资源 + 预计学习时间 + 里程碑。
  3. **行业洞察**：目标岗位的薪资范围、招聘趋势、核心竞争力分析。
- 输入：用户简历 + 目标岗位（可选，否则基于匹配结果推荐）。
- 输出：结构化的职业规划报告。

**新增文件**：`src/lib/agent/career.ts`
**修改文件**：`src/lib/agent/tools.ts`（advisor 工具增加 career 逻辑）

### ID-9: ReAct 循环升级 (B3)

**问题**：当前是固定 DAG，不能根据中间结果动态调整。

**方案**：
- 在 orchestrator 中引入 ReAct 循环，替换当前的 "LLM 规划 → 波次执行" 模式。
- 循环结构：
  ```
  while (iteration < MAX_ITERATIONS) {
    thought = LLM.think(context, previousObservations)  // 思考下一步
    action = LLM.decide(thought, availableTools)         // 选择工具
    observation = executeTool(action)                     // 执行并观察
    if (action.type === "finish") break                   // 完成退出
    iteration++
  }
  ```
- `MAX_ITERATIONS = 3`，硬上限防止无限循环。
- 保留当前的规则回退：如果 LLM 调用失败，回退到固定 DAG。
- `ReActStep` 类型正式启用：`{ thought: string, action: string, observation: string }`。
- 每轮的 thought/action/observation 写入 `AgentResponse.thinking` 数组，前端可展示推理过程。

**影响模块**：
- `src/lib/agent/orchestrator.ts` — 核心改造
- `src/lib/agent/types.ts` — `ReActStep` 正式启用
- `src/lib/agent/prompts/` — 新增 ReAct prompt

### ID-10: 流式输出 (B4)

**问题**：用户等到全部完成才看到结果。

**方案**：
- 采用 Server-Sent Events (SSE) 实现流式输出。
- 新增 `/api/agent/chat/stream` 路由（或在现有路由增加 `Accept: text/event-stream` 支持）。
- 流式事件类型：
  - `thinking` — Agent 思考过程
  - `tool_call` — 工具调用开始/完成
  - `content` — 响应内容片段
  - `done` — 完成信号
  - `error` — 错误信息
- 前端 `useAgentStream` hook 已存在，需扩展支持新的事件类型。
- LLM 调用本身不流式（MiMo API 是否支持流式待确认），但任务进度可以流式推送。

**影响模块**：
- `src/app/api/agent/chat/route.ts` — 增加 SSE 支持
- `src/hooks/useAgentStream.ts` — 扩展事件处理
- `src/app/agent/page.tsx` — UI 适配流式显示

### ID-11: MinerU OCR 集成 (C3)

**问题**：扫描件/图片 PDF 无法提取文字。

**方案**：
- 需先调研 MinerU 的集成方式（本地 Docker API / Python CLI / 云端服务）。
- 在 `src/lib/file-extract.ts` 中增加 OCR 降级路径：
  1. 先用 `unpdf` 尝试文本提取。
  2. 如果提取结果 < 5 字符，降级到 MinerU OCR。
  3. OCR 结果与文本提取结果合并。
- MinerU 调用封装为独立模块 `src/lib/ocr.ts`，方便替换实现。

**新增文件**：`src/lib/ocr.ts`
**修改文件**：`src/lib/file-extract.ts`（增加 OCR 降级）

**⚠️ 阻塞项**：需要先调研 MinerU 集成方案，确认是 Docker API 还是 CLI。

### ID-12: 外企公司名识别 (C4)

**问题**：公司名识别靠中文关键词（公司/科技/集团），外企名（Google/Apple）识别不到。

**方案**：
- 扩展公司识别模式：
  - 增加英文公司名列表：Google, Apple, Microsoft, Amazon, Meta, Netflix, Uber, Airbnb, ByteDance, Tencent, Alibaba, Huawei, Xiaomi 等 50+ 家。
  - 增加模式匹配：`/[A-Z][a-z]+ ?(Inc|Corp|Ltd|LLC|Co\.)/`。
  - 保留中文关键词匹配作为并行路径。
- 放在 `src/lib/resume-parser.ts` → `extractExperience` 函数中。

**影响模块**：`src/lib/resume-parser.ts` → `extractExperience` 函数。

### ID-13: 测试策略 (D1-D4)

**测试原则**：
- 通过公共接口验证行为，不 mock 内部实现。
- 纯函数直接测试输入输出。
- AI 函数 mock LLM 客户端，验证 prompt 构造和结果解析。
- Agent 工具 mock 底层依赖（matcher/parser/ai），验证编排逻辑。

**模块测试计划**：

| 模块 | 测试类型 | 用例数目标 |
|---|---|---|
| D1: matcher 关键词/日期/权重 | 纯函数单元测试 | 15+ |
| D2: agent 工具链 | mock 依赖的集成测试 | 10+ |
| D3: AI 函数 | mock LLM 的单元测试 | 10+ |
| D4: 总体覆盖率 | 补充边界用例 | 100+ 总计 |

---

## Testing Decisions

### 什么是一个好的测试

1. **测试外部行为，不测试内部实现** — 测试函数的输入输出，不关心内部调了几个 helper。
2. **边界条件优先** — 空输入、极端值、格式异常是最高价值的测试。
3. **命名即文档** — 测试名应描述场景和期望结果，如 `"should not trigger entry-level weight for '10-15年'"`。
4. **独立可重复** — 每个测试不依赖其他测试的执行顺序或外部状态。

### 测试接缝

| 接缝 | 文件 | 测试方式 |
|---|---|---|
| `calculateSkillMatch` | `matcher.test.ts` | 直接调用，构造 ParsedResume + Job |
| `calculateEducationMatch` | `matcher.test.ts` | 直接调用，构造 Education[] + Job |
| `calculateExperienceMatch` | `matcher.test.ts` | 直接调用，构造 Experience[] + Job |
| `calculateKeywordMatch` | `matcher.test.ts` | 直接调用，构造 ParsedResume + Job |
| `matchResumeToJobs` | `matcher.test.ts` | 直接调用，构造完整输入 |
| `extractName` | `resume-parser.test.ts` | 直接调用，传入文本字符串 |
| `extractSkills` | `resume-parser.test.ts` | 直接调用，传入文本字符串 |
| `runAgent` | 新建 `agent.test.ts` | mock tools，验证编排逻辑 |
| `recognizeIntent` | 新建 `agent.test.ts` | mock LLM，验证意图识别 |
| `aiParseResume` | `ai.test.ts` | mock OpenAI client |
| `aiAnalyzeMatch` | `ai.test.ts` | mock OpenAI client |

### 先有测试

- `src/lib/matcher.test.ts` — 9 个现有测试，扩展到 24+
- `src/lib/resume-parser.test.ts` — 现有测试，扩展
- `src/lib/ai.test.ts` — 2 个现有测试（extractJSON/sanitizeJSON），扩展到 12+
- `src/lib/resume-mapper.test.ts` — 现有测试保持
- `src/lib/schemas.test.ts` — 现有测试保持
- 新建 `src/lib/agent/agent.test.ts` — Agent 工具链测试

---

## Out of Scope

以下不在本次迭代范围内：

1. **BOSS 直聘自动化增强** — 当前功能已稳定，不在此轮修改。
2. **投递记录管理增强** — 漏斗/状态追踪已完整。
3. **多用户体系/付费功能** — 产品化阶段再考虑。
4. **数据库迁移** — Prisma schema 不变。
5. **UI/UX 改版** — 仅做流式输出的 UI 适配，不做整体改版。
6. **Vercel 部署优化** — 剩余低优项（standalone output、区域评估）留后续。
7. **saveSessionMemory 竞态修复** — 低并发场景可接受。

---

## Further Notes

### 实施建议

1. **每个 Issue 一个 PR** — 16 项增强拆为独立 Issue，逐个 TDD 实现。
2. **P0 先行** — A1-A4 + C1-C2 是准确性修复，影响你每天投简历的体验，优先做完。
3. **C3 (MinerU) 需要调研** — 这是唯一有外部依赖的项，建议尽早启动调研。
4. **B3 (ReAct) 是架构改造** — 影响面最大，建议在其他项稳定后再做。

### 风险

- **B3 ReAct 循环**：改造 orchestrator 核心逻辑，可能影响所有 Agent 功能。需要充分测试。
- **B4 流式输出**：取决于 MiMo API 是否支持流式。如果不支持，只能做任务进度流式。
- **C3 MinerU**：集成方式未确定，可能需要额外部署。
