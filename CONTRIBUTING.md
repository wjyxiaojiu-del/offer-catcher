# 贡献指南

感谢你对 Offer Catcher 的关注！我们欢迎任何形式的贡献。

## 如何贡献

### 1. Fork & Pull Request 流程

1. Fork 本仓库到你的个人账号下。
2. 基于 `main` 分支创建新的功能分支：`git checkout -b feat/your-feature-name`
3. 提交你的修改，并确保 commit message 清晰描述变更内容。
4. 向本仓库的 `main` 分支提交 Pull Request。
5. 等待维护者 Review，根据反馈进行调整。

### 2. 提交前检查

- **运行测试**：确保所有测试通过后再提交 PR。
  ```bash
  npm test
  ```
- **代码风格**：保持与现有代码风格一致。项目使用默认的 ESLint / Prettier 配置，提交前建议运行格式化：
  ```bash
  npm run lint
  ```

### 3. Issue 提交建议

- 提交 Bug 时，请描述**复现步骤**、**预期行为**和**实际行为**，并附上环境信息（Node.js 版本、操作系统等）。
- 提交功能请求时，请说明**使用场景**和**期望的解决方案**。
- 如果可能，先搜索已有 Issue，避免重复提交。

## 行为准则

请保持友善和尊重，共同维护良好的社区氛围。
