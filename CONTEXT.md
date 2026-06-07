# Offer 捕手 — 领域词汇表

## 核心实体

- **简历 (Resume)** — 用户上传的求职简历，经解析后生成结构化的 `ParsedResume`（姓名/技能/学历/经历/项目）
- **岗位 (Job)** — 招聘岗位，来源为内置岗位库（`data/jobs.ts`）或用户自定义 JD
- **匹配结果 (MatchResult)** — 简历与岗位的四维评分（技能/学历/经验/关键词）+ 匹配等级（excellent/good/fair/weak）
- **投递记录 (Application)** — 一次投递行为的状态追踪（applied→interview→offer/rejected）
- **Agent 会话 (AgentSession)** — 对话式求职 Agent 的会话上下文，含短期记忆与长期偏好

## 匹配维度

- **技能匹配 (Skill Match)** — 四级级联：精确匹配 → 同义词匹配 → 原文词边界匹配 → Levenshtein 模糊匹配
- **学历匹配 (Education Match)** — 学位等级差值评分 + 学校层级加分（985/211/一本）
- **经验匹配 (Experience Match)** — 工作时长与岗位要求的比值评分
- **关键词匹配 (Keyword Match)** — 岗位关键词在简历原文中的加权命中率
- **动态权重 (Dynamic Weight)** — 根据岗位类型（AI/研究/应届）调整四维权重
- **项目评分 (Project Score)** — 项目经历与岗位的匹配质量（当前仅数量，需升级为相关性+质量）

## Agent 能力

- **意图识别 (Intent Recognition)** — 规则优先 + LLM 兜底，7 种意图
- **任务规划 (Task Planning)** — LLM 分解 DAG + 规则回退，波次并行执行
- **ReAct 循环 (ReAct Loop)** — 观察工具结果后动态决策下一步，最多 3 轮迭代（待实现）
- **流式输出 (Streaming)** — 边生成边输出，用户无需等待全部完成（待实现）
- **模拟面试 (Mock Interview)** — 技术面+行为面混合模式，根据 JD 自动判断类型（待实现）
- **职业规划 (Career Advice)** — 技能差距分析 + 学习路线图 + 行业洞察 + 岗位推荐（待实现）
- **工具 (Tools)** — 12 个已注册工具（解析/匹配/搜索/分析/投递/记忆/顾问）
- **记忆 (Memory)** — 会话级 JSON blob + 用户级 key-value 双层持久化

## 简历解析

- **规则引擎 (Rule Engine)** — 正则+词典+分段提取，快速但覆盖有限
- **LLM 解析 (AI Parse)** — MiMo LLM 结构化提取，质量高但有超时风险
- **技能词典 (Skill Dict)** — 硬编码技能词库，目标从 80 扩到 200+（待实现）
- **OCR (MinerU)** — 扫描件/图片 PDF 文字提取，需调研 MinerU 集成方案（待实现）

## 安全

- **令牌鉴权 (API Guard)** — 常量时间比较防时序攻击
- **三档限流 (Rate Limit)** — general / ai / boss 按 IP 分级
- **Prompt 注入防护 (Escape)** — 剥离结构标签 + 截断 + 转义
