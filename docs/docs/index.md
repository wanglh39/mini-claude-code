# Mini Claude Code

> 从零实现 Claude Code，理解 AI Agent 架构本质
>
> 教学向 · TypeScript · Anthropic API · 10 章递进 · 每章独立可运行

---

## 这是什么

一个教学项目，用 10 个递进章节（Ch0→Ch9），从 **50 行最小 CLI** 到 **2000 行完整工具**，逐步复刻 Claude Code 的核心能力。

Claude Code 的本质是一个 **Agent Loop（智能体循环）**：

```
用户输入 → LLM → 有工具调用？
                    ├─ 是 → 执行工具 → 结果加入对话 → 回到 LLM
                    └─ 否 → 输出文本 → 等待下一轮输入
```

所有复杂功能（流式、权限、上下文压缩、子智能体）都是在这个骨架上加肉。本项目的目标就是把这个骨架一步步拆开给你看。

---

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/wanglh39/mini-claude-code.git
cd mini-claude-code

# 进入任一章节
cd lessons/ch01-minimal

# 安装依赖
npm install

# 配置 API Key
cp .env.example .env
# 编辑 .env，填入你的 API Key

# 运行
npx tsx main.ts
```

### API 后端

支持两种后端，代码零改动切换：

| 后端 | API Key 来源 | baseURL | model |
|------|-------------|---------|-------|
| Anthropic 官方 | [console.anthropic.com](https://console.anthropic.com) | （留空） | `claude-sonnet-4-20250514` |
| DeepSeek | [platform.deepseek.com](https://platform.deepseek.com) | `https://api.deepseek.com/anthropic` | `deepseek-chat` |

---

## 章节目录

| 章 | 标题 | 代码量 | 核心知识点 |
|----|------|--------|-----------|
| [Ch0](architecture.md) | 架构原理拆解 | 0 | Agent Loop 本质、tool_use 协议 |
| [Ch1](ch01.md) | 最小可对话 CLI | ~50行 | API 调用、多轮对话 |
| [Ch2](ch02.md) | 加工具(Read/Write) | ~150行 | tool_use 协议、内层循环 |
| [Ch3](ch03.md) | 完整工具集 | ~400行 | Edit/Bash/Glob/Grep |
| [Ch4](ch04.md) | 流式输出 | ~600行 | streaming 事件处理 |
| [Ch5](ch05.md) | System Prompt | ~800行 | prompt 工程、环境注入 |
| [Ch6](ch06.md) | 上下文管理 | ~1000行 | token 计数、压缩 |
| [Ch7](ch07.md) | 权限与安全 | ~1200行 | 确认机制、边界控制 |
| [Ch8](ch08.md) | 子智能体 | ~1500行 | Task 工具、agent 编排 |
| [Ch9](ch09.md) | 整合打包 | ~2000行 | 完整 CLI、配置管理 |

---

## 学习路径建议

### 如果你是 Agent 新手

按顺序从 Ch0 读到 Ch9。每章读完运行代码，体会差异。

### 如果你已了解 Agent 概念

直接看 [架构原理](architecture.md)，然后跳到 [Ch9 整合打包](ch09.md) 看完整实现，再按需回看各章。

### 如果你想理解某个特定方面

| 想理解 | 看这章 |
|--------|--------|
| Agent 的本质 | Ch0 + Ch1 |
| 工具调用怎么工作 | Ch2 |
| 流式输出怎么处理 | Ch4 |
| 怎么约束模型行为 | Ch5 |
| 长对话怎么处理 | Ch6 |
| 安全怎么保障 | Ch7 |
| 子智能体怎么编排 | Ch8 |

---

## 技术栈

- **TypeScript** + Node.js ≥ 20
- **@anthropic-ai/sdk** — 官方 SDK，tool_use 协议原汁原味
- **tsx** — 免编译直接运行 .ts
- **MkDocs Material** — 文档站

---

## 致谢

本项目受 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 启发，旨在教学拆解其架构设计。

## License

MIT