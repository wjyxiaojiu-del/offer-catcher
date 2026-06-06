# Offer 捕手 — AI 求职智能匹配 Agent

AI 驱动的学生求职匹配系统：上传简历 → 智能匹配岗位 → 诊断优化 → 一键投递。
内置对话式求职 Agent（ReAct 编排）与 BOSS 直聘自动投递能力。

## 功能特性

- **对话式求职 Agent** — 自然语言交互，自动完成意图识别 → 任务规划 → 工具调用 → 记忆管理（`/agent`）
- **智能岗位匹配** — 内置岗位库，四维度（技能/学历/经验/关键词）动态加权打分
- **简历解析** — PDF / DOCX / TXT 上传，规则引擎优先、LLM 兜底的双路解析
- **AI 分析报告** — 雷达图可视化 + 逐项分析 + 优化建议
- **针对 JD 优化** — 粘贴任意岗位 JD，获取针对性简历优化方案
- **批量投递** — 设置策略（匹配度/城市/薪资/类型）后筛选并批量投递（模拟）
- **BOSS 直聘自动投递** — Playwright 真实驱动浏览器，扫码登录后自动打招呼投递（需显式开启，见下）
- **投递记录管理** — 投递漏斗、状态追踪、手动/自动分类

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 15（App Router）+ React 18 + TypeScript（strict） |
| 样式 | Tailwind CSS + framer-motion |
| 数据 | Prisma + SQLite（含 Agent 记忆模型） |
| LLM | 小米 MiMo（OpenAI 兼容接口），规则引擎降级双保险 |
| 简历解析 | unpdf（PDF）+ mammoth（DOCX）+ 正则规则引擎 |
| 浏览器自动化 | Playwright（BOSS 直聘自动投递） |
| 匹配算法 | 同义词表 + 编辑距离模糊匹配 + 动态权重 |

## 快速开始

```bash
# 1. 安装依赖（postinstall 会自动 prisma generate）
npm install

# 2. 配置环境变量
cp .env.example .env
#   - 填入 MIMO_API_KEY 启用 LLM（留空则自动降级为纯规则引擎）
#   - 生产环境务必设置 OFFER_CATCHER_ACCESS_TOKEN

# 3. 初始化数据库
npx prisma db push

# 4. 开发模式
npm run dev

# 5. 生产构建
npm run build && npm run start
```

## 环境变量

见 `.env.example`。关键项：

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | SQLite 路径，默认 `file:./prisma/dev.db` |
| `OFFER_CATCHER_ACCESS_TOKEN` | **生产环境必填**。访问简历/投递/AI/浏览器自动化 API 前需用此令牌鉴权 |
| `MIMO_API_KEY` | LLM 密钥。留空则所有 AI 能力自动降级为规则引擎，应用仍可用 |
| `MIMO_BASE_URL` / `MIMO_MODEL` | LLM 接口地址与模型名 |
| `MIMO_TIMEOUT_MS` | 单次 LLM 调用超时（默认 12000ms） |
| `BOSS_AUTOMATION_ENABLED` | **默认 false**。BOSS 直聘自动投递的总开关，仅在可信本地环境开启 |
| `BOSS_HEADLESS` | 是否无头运行浏览器（首次扫码登录需 false） |

> ⚠️ **BOSS 自动投递仅供本地自用研究**。它会真实驱动浏览器操作你的 BOSS 直聘账号，请勿在共享/公网环境开启，并遵守目标平台的服务条款。

## 安全设计

- **令牌鉴权**：所有数据/AI/自动化 API 经 `requireApiAccess` 校验访问令牌（常量时间比较防时序攻击）
- **三档限流**：general / ai / boss 按 IP 分级限流
- **Prompt 注入防护**：用户简历/JD 内容进入 LLM 前剥离结构标签并加防护指令
- **BOSS 自动化双重门禁**：令牌 + `BOSS_AUTOMATION_ENABLED=true` 缺一不可

## 项目结构

```
src/
├── app/
│   ├── page.tsx              # 首页（简历上传）
│   ├── agent/page.tsx        # 对话式求职 Agent
│   ├── match/page.tsx        # 匹配结果页
│   ├── jd-optimize/page.tsx  # JD 针对性优化
│   ├── auto-apply/page.tsx   # 批量投递（模拟）
│   ├── boss/page.tsx         # BOSS 直聘自动投递
│   ├── applications/page.tsx # 投递记录
│   └── api/                  # API 路由（均经鉴权守卫）
├── components/               # 可复用组件（CountUp/Radar/Skeleton/NavBar/...）
├── data/jobs.ts              # 内置岗位数据
├── lib/
│   ├── agent/                # Agent 层：orchestrator/planner/responder/memory/tools/prompts
│   ├── ai.ts                 # LLM 集成（解析/匹配/优化/意图识别）
│   ├── matcher.ts            # 规则匹配引擎
│   ├── resume-parser.ts      # 规则简历解析
│   ├── boss-auto.ts          # Playwright BOSS 自动化
│   ├── api-guard.ts          # 鉴权 + 限流
│   └── db.ts                 # Prisma 单例
└── prisma/schema.prisma      # 数据模型
```

## Agent 工作流

`/agent` 页面的对话经过完整 ReAct 流水线（`src/lib/agent/orchestrator.ts`）：

1. **意图识别** — 规则优先（0 延迟 0 成本），歧义时 LLM 兜底
2. **任务规划** — LLM 分解任务图，失败回退规则引擎
3. **任务执行** — 按依赖拓扑并发执行工具（解析/匹配/分析/投递）
4. **响应生成** — LLM 生成自然语言回复，失败回退模板
5. **记忆持久化** — 会话短期记忆 + 用户长期偏好写入 Prisma

> 设计哲学：**规则优先、LLM 兜底**。高频路径零 API 成本、零延迟、可解释；复杂场景由 LLM 增强。任一 LLM 调用失败都有规则降级，保证应用始终可用。
