# 与真实 Claude Code 全面对比

> 本章对比 Mini Claude Code（Ch9 最终版）与 Anthropic 官方 Claude Code 的差异。
> 目标不是追求功能对等，而是理解"我们简化了什么、原版多做了什么、为什么"。

---

## 架构对比

| 方面 | Mini Claude Code | Claude Code |
|------|-----------------|-------------|
| 语言 | TypeScript | TypeScript |
| 代码量 | ~2000 行 | ~50000 行 |
| 核心架构 | Agent Loop | Agent Loop（同构） |
| 运行时 | Node.js | Node.js |

**核心架构完全同构**。差异在工程复杂度和功能覆盖面。

---

## 功能对比

### Agent Loop

| 方面 | Mini | 原版 |
|------|------|------|
| 外层循环 | `while (true)` + readline | 同 |
| 内层循环 | `stop_reason` 分支 | 同 |
| 流式处理 | `for await (event of stream)` | 同 |
| 事件类型 | text_delta, input_json_delta | 同 + 更多事件处理 |

### 工具系统

| 工具 | Mini | 原版 |
|------|------|------|
| read_file | 基本读取 + 2000 行截断 | 支持 offset/limit、图片读取、PDF |
| write_file | 覆盖写入 | 同 + 文件历史 |
| edit_file | 唯一匹配替换 | 同 + replaceAll、多文件编辑 |
| bash | exec + timeout | 有工作目录注入、环境变量、shell 配置、输出过滤 |
| glob | 手写递归 | 用 fast-glob，支持更多语法 |
| grep | 手写遍历 | 用 ripgrep（rg），更快 |
| task | 串行子 Agent | 并行（最多 10 个），多种 subagent_type |
| MCP | 无 | 支持 Model Context Protocol |
| TodoWrite | 无 | 有 |
| WebFetch | 无 | 有 |
| Question | 无 | 有 |

### System Prompt

| 方面 | Mini | 原版 |
|------|------|------|
| 长度 | ~400 字 | 数千字 |
| 工具规则 | 基本原则 | 每个工具有详细使用规则 |
| 项目感知 | git 分支 + 变更数 | 检测 npm/cargo/go 等项目类型 |
| AGENTS.md | 无 | 支持项目级 prompt 覆盖 |
| 动态注入 | cwd, git, os, date | + package.json, 目录结构, 最近改动 |
| 技能系统 | 无 | Skills 加载 |
| 记忆系统 | 无 | 持久化 memory |

### 上下文管理

| 方面 | Mini | 原版 |
|------|------|------|
| token 计数 | API usage 返回 | 用 tokenizer 精确计数 |
| 截断策略 | 头尾保留 | 智能截断（保留关键信息） |
| 压缩 | 用模型总结 | `compactConversation` 专用 prompt |
| 触发时机 | 80% 预警 | 多级阈值 |
| 状态显示 | token 数 + 百分比 | 同 |

### 权限系统

| 方面 | Mini | 原版 |
|------|------|------|
| 权限层级 | 安全/危险两类 | 细粒度规则配置 |
| 确认方式 | y/n | y/n + "始终允许" + 规则配置 |
| 危险检测 | 正则模式匹配 | 命令解析 + 模式匹配 |
| 路径边界 | 无 | 工作目录限制 |
| 拒绝处理 | 返回拒绝信息 | 同 |

### 子智能体

| 方面 | Mini | 原版 |
|------|------|------|
| subagent_type | 无分类 | explore, general, code-reviewer 等 |
| 并行 | 串行 | 支持最多 10 个并行 |
| 工具集 | 排除 task | 按 subagent_type 配置 |
| system prompt | 通用 | 按 subagent_type 定制 |
| 上下文限制 | 20 次迭代 | 有 token 限制 + 压缩 |

---

## 原版有而我们没做的

### MCP (Model Context Protocol)

MCP 是一个标准协议，让外部工具能接入 Agent。Claude Code 支持 MCP，可以接入 GitHub、Slack、数据库等外部服务。

我们没做：MCP 是一个完整的协议实现，超出教学范围。

### IDE 集成

Claude Code 有 VS Code 插件，能在编辑器内使用。

我们没做：需要 IDE 插件开发，不是 Agent 核心架构。

### 插件系统

Claude Code 支持插件扩展。

我们没做：插件系统是工程化需求，不是架构原理。

### 配置继承

Claude Code 有 AGENTS.md 机制，项目可以定义自己的规则覆盖默认行为。

我们没做：可以作为扩展练习。

### 持久化记忆

Claude Code 有 memory 系统，跨会话记住用户偏好。

我们没做：需要存储层，不是 Agent 核心循环。

---

## 我们简化但核心一致的

| 功能 | 简化点 | 核心一致 |
|------|--------|----------|
| Agent Loop | 无错误重试 | ✓ 两层循环结构 |
| 工具执行 | 无参数校验 | ✓ tool_use 协议 |
| 流式输出 | 无 markdown 渲染 | ✓ 事件处理 |
| 上下文管理 | 无 tokenizer | ✓ 截断+压缩策略 |
| 权限系统 | 无路径边界 | ✓ 确认 gate |
| 子智能体 | 串行 | ✓ 独立循环+上下文隔离 |

---

## 结论

**Mini Claude Code 的 2000 行代码包含了 Claude Code 架构的全部核心设计。**

理解了这 2000 行，你就理解了：

1. **Agent Loop** — 两层循环，外层等用户，内层跑工具
2. **tool_use 协议** — 模型请求 → 代码执行 → 结果回传
3. **流式输出** — 逐 token 推送，碎片拼接
4. **System Prompt** — 规则注入，约束行为
5. **上下文管理** — token 计数，截断，压缩
6. **权限系统** — 安全 gate，危险检测
7. **子智能体** — 独立循环，上下文隔离

这些是所有 AI Agent 产品的通用骨架。Claude Code 的 48000 行差异，主要是工程化打磨（错误处理、UI 渲染、MCP 协议、IDE 集成、插件系统等），而非架构创新。

---

## 扩展练习

如果你想继续深入，可以尝试：

1. **加 MCP 支持** — 实现一个简单的 MCP 客户端，接入外部工具
2. **加并行子 Agent** — 用 Promise.all 实现并行 spawn
3. **加 AGENTS.md** — 读取项目根目录的 AGENTS.md，合并到 system prompt
4. **加 memory** — 用文件存储跨会话记忆
5. **加 TodoWrite** — 实现任务列表工具
6. **加 WebFetch** — 实现网页抓取工具
7. **用 tokenizer** — 用 @anthropic-ai/tokenizer 精确计数 token
8. **加路径边界** — 限制工具只能操作工作目录内的文件

每个扩展练习都能让你更深入理解 Claude Code 的某个方面。