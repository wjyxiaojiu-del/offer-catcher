# Offer 捕手 — AI 求职智能匹配智能体

AI 驱动的学生求职匹配系统，帮助学生高效匹配合适岗位并提升简历通过率。

## 功能特性

- **智能岗位匹配** — 25 个热门岗位，四维度（技能/学历/经验/关键词）打分
- **简历解析** — 支持 PDF / DOCX / TXT 三种格式上传
- **AI 分析报告** — 雷达图可视化 + 详细分析 + 优化建议
- **针对 JD 优化** — 粘贴任意岗位 JD，获取针对性简历优化方案
- **一键批量投递** — 设置投递策略（匹配度/城市/薪资/类型），自动筛选并批量投递
- **投递记录管理** — 投递漏斗、状态追踪、手动/自动分类
- **演示引导路径** — 右下角按钮，6 步引导评委走完全流程

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build
npm run start
```

## 技术栈

- **框架:** Next.js 14 (App Router)
- **样式:** Tailwind CSS
- **简历解析:** pdf-parse + mammoth
- **匹配算法:** 同义词匹配 + 编辑距离 + 动态权重

## 项目结构

```
src/
├── app/
│   ├── page.tsx              # 首页（简历上传）
│   ├── match/page.tsx        # 匹配结果页
│   ├── jd-optimize/page.tsx  # JD 针对性优化
│   ├── auto-apply/page.tsx   # 一键批量投递
│   ├── applications/page.tsx # 投递记录
│   └── api/                  # API 路由
├── components/               # 可复用组件（CountUp/Radar/Skeleton/DemoGuide）
├── data/jobs.ts              # 岗位数据（25个）
└── lib/                      # 核心逻辑（matcher/resume-parser）
```
