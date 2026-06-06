# Offer 捕手 — 后续优化清单

> 基于 2026-06-06 全面审查,阶段 A+B 已全部完成。以下为已知但尚未修的技术债和改进机会。

---

## 🔴 P0 — 生产前必做

### 1. Prisma 缺关键查询索引
`Application.status`、`Application.appliedAt`、`Application.resumeId`、`Application.jobId`、`Job.title+company` 均无索引。SQLite 小数据量无感,但投递记录增长后 `findMany` 会全表 sort。
- **做法**: schema 加 `@@index([status])` / `@@index([appliedAt])` / `@@index([title, company])`,跑 `prisma db push`

### 2. 限流桶 Map 永不清理(api-guard.ts:15)
`buckets = new Map()` 按 IP+kind 累积 key,永不删除过期条目。被刷不同 IP 时内存无限增长。
- **做法**: `rateLimit()` 开头加一行 `for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k)`

### 3. 内存 Map fallback 不可靠(`auto-apply/route.ts:9`、`apply/route.ts:16`)
`const applications = new Map()` 作为 DB 不可用时的兜底存储。Serverless 多实例不共享、冷启动丢失、永不清理。
- **做法**: 去掉 Map fallback,catch 里直接返回错误(数据不一致比静默丢失更糟)

---

## 🟡 P1 — 明显提升用户体验

### 4. match page 接入 `scoreColor()`/`barColor()`
`src/app/match/page.tsx` 仍有自己的分数→颜色阈值逻辑(与 agent 页 3 处重复)。已抽出 `lib/ui-utils.ts`,只需替换。
- **做法**: import `scoreColor`,替换 match page 里的 inline 三元

### 5. `withTimeout` 底层 promise 不取消
定时器已清理(B2),但 `Promise.race` 输的一方(原始 LLM promise)仍会后台跑完消耗资源。对无超时的 `chat()` 尤其浪费。
- **做法**: 传 `AbortSignal` 给 `withTimeout`,timeout 时 `signal.abort()` 取消底层 promise;或改用 `AbortSignal.any()` 组合信号

### 6. `boss-auto.ts` 的 `generateGreeting` 绕过 ai.ts
`generateGreeting`(boss-auto.ts:285)自己 `new OpenAI(...)` 调用,绕过了 ai.ts 的重试/转义/超时。`resumeSkills.join(", ")` 未转义直接进 prompt。
- **做法**: 改用 `callLLM()`(ai.ts 导出),或至少 import `escapeUserContent` 转义 user 内容

### 7. `boss/route.ts` 的 `(r: any)` 类型
route 里 `results.filter((r: any) => r.status === "sent")` 应用 `BossJob` 类型(项目已有定义但 route 没用)。
- **做法**: import `BossJob` from types,替换 `any`

### 8. agent/page.tsx 残余 `any`
`msg.matches` 和 `m: any` 仍用 any。已有 `MatchResult` 类型可用。
- **做法**: `ChatMessage.matches` 改为 `MatchResult[] | undefined`,渲染处去掉 `(m: any)`

---

## 🟢 P2 — 长期质量提升

### 9. Prisma schema `@@unique` 防岗位重复
`applications/route.ts` 和 `jobs/route.ts` 用 find-then-create,并发会创建重复 Job。schema 在 `title+company` 上无唯一约束。
- **做法**: schema 加 `@@unique([title, company])`,路由改用 `upsert`

### 10. `AgentSession` read-modify-write 竞态(B2 已标注)
`saveSessionMemory` 先读 JSON blob → 改 → 写回,并发两次写入会 lost update。
- **做法**: 低并发场景可接受(已标注注释)。高并发时改用 per-key column 或行锁

### 11. `next.config.js` 为空
可加安全 headers(X-Content-Type-Options、X-Frame-Options 等)、图片优化、bundle 分析等。
- **做法**: 补 `headers()` + `images.remotePatterns` 配置

### 12. 补更多测试
当前 34 用例覆盖 matcher/resume-mapper/schemas。可扩展:
- `ai.ts`: sanitizeJSON 对畸形 LLM 输出的鲁棒性
- `resume-parser.ts`: 各字段提取
- `lib/markdown.tsx`: renderMarkdown 纯函数,天然适合单测
- `hooks/useChatSessions.ts`: 可用 @testing-library/react 测试

### 13. 移动端侧边栏 a11y
agent/page.tsx 的遮罩层用 `<div onClick>` 而非按钮,键盘用户无法关闭(无 Esc / focus trap)。
- **做法**: 遮罩改 `<button>`,加 `onKeyDown={Escape}`

### 14. ErrorBoundary 泄漏内部信息
`error-boundary.tsx:41-42` 直接展示 `error.message`。生产环境可能泄漏堆栈。
- **做法**: 生产环境只显示"出错了,请刷新",开发环境显示详情

### 15. Vercel 部署区域优化
`vercel.json` 写死 `hkg1`(香港)。如果主要用户在大陆,hkg1 合理;但 LLM 调用走新加坡(`token-plan-sgp`),可以评估是否需要多区域。
