# Offer 捕手 — 优化清单

> 全面审查完成于 2026-06-06,阶段 A + B + P0 + P1 + P2 全部完成。
> v2 增强迭代规划完成于 2026-06-07，16 项增强已拆为 GitHub Issues (#1-#16)。

---

## ✅ 已完成

### 阶段 A — Demo 关键
- [x] A1: Playwright 单例并发竞态修复
- [x] A2: withTimeout 清理定时器
- [x] A3: 直连 LLM 路由加超时
- [x] A4: 移动端底部导航
- [x] A5: 文档重写(如实反映架构)
- [x] 构建栈溢出修复

### 阶段 B — 长期地基
- [x] B1: 消除 resume-agents 5× 冗余 LLM 调用
- [x] B2: AgentMessage 外键模型 bug 修复
- [x] B3: zod 运行时输入校验
- [x] B4: 安全补洞(auth 限流 / history 转义 / 错误脱敏)
- [x] B5+B6: 重构去重(file-extract + resume-mapper)
- [x] B7: 拆分 agent 巨石组件(721→439 行)
- [x] B8: vitest + 34 用例

### P0 — 生产前必做
- [x] Prisma 索引(Application.status/appliedAt/resumeId/jobId, Job.title+company)
- [x] 限流桶 Map 过期清理
- [x] 去掉不可靠的内存 Map fallback

### P1 — 明显提升
- [x] match page 接入 scoreColor/barColor
- [x] withTimeout 可选 abortController 参数
- [x] boss-auto generateGreeting 统一用 ai.ts
- [x] boss/route + agent/page 消除 any 类型

### P2 — 长期质量
- [x] Prisma @@unique([title, company]) + 路由改 upsert
- [x] next.config.js 安全 headers
- [x] agent 页侧边栏遮罩 a11y(button + Esc)
- [x] ErrorBoundary 生产环境脱敏
- [x] 补测试(31 新用例,总计 65 全绿)

---

## ⏸️ 未修(低优先级,按需推进)

### 10. `saveSessionMemory` read-modify-write 竞态
已标注注释。低并发场景可接受。高并发时改用 per-key column 或行锁。

### 11. `next.config.js` 图片优化 / bundle 分析
安全 headers 已加。可进一步加 `images.remotePatterns`、`output: "standalone"` 等。

### 15. Vercel 部署区域评估
`vercel.json` 写死 `hkg1`。LLM 调用走新加坡。可评估是否需要多区域。

---

## 📋 v2 增强迭代 (Issues #1-#16)

> PRD: `docs/prd/001-feature-enhancement.md`
> 实施顺序：P0 准确性 → P1 功能 → P2 测试

### P0 准确性 (Issues #1-#6)
- [x] #1: A1 - entry-level 误触发修复 ✅ (2026-06-07)
- [x] #2: A2 - 学校层级误加分修复 ✅ (2026-06-07)
- [x] #3: A3 - 关键词权重区分 ✅ (2026-06-07)
- [x] #4: A4 - 项目评分升级 ✅ (2026-06-07)
- [x] #5: C1 - 名字提取增强 ✅ (2026-06-07)
- [ ] #2: A2 - 学校层级误加分修复
- [ ] #3: A3 - 关键词权重区分
- [ ] #4: A4 - 项目评分升级
- [ ] #5: C1 - 名字提取增强
- [ ] #6: C2 - 技能词典扩充 (80→200+)

### P1 功能 (Issues #7-#12)
- [ ] #7: B1 - mock_interview 补全 (混合面试模式)
- [ ] #8: B2 - career_advice 补全 (全面职业规划)
- [ ] #9: B3 - ReAct 循环升级 (最多 3 轮)
- [ ] #10: B4 - 流式输出 (SSE)
- [ ] #11: C3 - MinerU OCR 集成 (需调研)
- [ ] #12: C4 - 外企公司名识别

### P2 测试 (Issues #13-#16)
- [ ] #13: D1 - matcher 高风险模块补测试
- [ ] #14: D2 - agent 工具链补测试
- [ ] #15: D3 - AI 函数补测试
- [ ] #16: D4 - 总体覆盖率提升 (目标 100+)
