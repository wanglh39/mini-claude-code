# 第九章：整合打包 — 完整 CLI

> 前 8 章功能的整合，加参数解析和配置管理，打包成完整 CLI 工具。

## 目标

把所有功能整合到一个结构清晰的项目中，支持 CLI 参数和配置文件。

## 核心原理

### 模块化组织

```
src/
├── main.ts           # 入口：解析参数 → 启动
├── cli.ts            # CLI 参数解析
├── config.ts         # 配置加载（env + args）
├── agent-loop.ts     # 核心循环（整合 Ch1-Ch8）
├── tools/            # 完整工具集（Ch3）
├── prompts/          # System prompt（Ch5）
├── context.ts        # 上下文管理（Ch6）
├── permission.ts     # 权限系统（Ch7）
└── subagent.ts       # 子智能体（Ch8）
```

### 配置优先级

```
命令行参数 > 环境变量(.env) > 默认值
```

```typescript
const model = args.model || process.env.MODEL || "claude-sonnet-4-20250514";
```

### 入口流程

```
main.ts
  → parseArgs()      解析命令行参数
  → loadConfig()     加载配置（env + args）
  → runAgentLoop()   启动 Agent 循环
    → runInnerLoop()  内层工具调用循环
```

## 代码结构

### cli.ts — 参数解析

```typescript
function parseArgs(argv: string[]): CLIArgs {
  // 解析 --model, --auto-approve, --help 等
}

function printHelp(): void {
  // 显示帮助信息
}
```

### config.ts — 配置加载

```typescript
function loadConfig(args: CLIArgs): Config {
  // 合并 env + args，校验必填项
  if (!apiKey) {
    console.error("错误: 未配置 API_KEY");
    process.exit(1);
  }
  return { apiKey, model, maxTokens, ... };
}
```

### agent-loop.ts — 核心循环

整合了：
- 流式输出（Ch4）
- System prompt（Ch5）
- 上下文管理（Ch6）
- 权限确认（Ch7）
- 子智能体（Ch8）

```typescript
async function runAgentLoop(config: Config) {
  const client = new Anthropic({ apiKey, baseURL });
  const ctx = new ContextManager(config.contextLimit);
  const perm = new PermissionManager(config.autoApprove);

  while (true) {  // 外层
    const userInput = await prompt("\n> ");
    ctx.addMessage({ role: "user", content: userInput });
    await runInnerLoop(client, config, systemPrompt, ctx, perm);
  }
}
```

## 运行方式

```bash
cd lessons/ch09-final
npm install
cp .env.example .env
# 编辑 .env，填入 API_KEY

# 基本运行
npx tsx src/main.ts

# 带参数运行
npx tsx src/main.ts --model deepseek-chat --base-url https://api.deepseek.com/anthropic

# 自动批准（跳过确认）
npx tsx src/main.ts --auto-approve

# 查看帮助
npx tsx src/main.ts --help
```

## 功能一览

| 功能 | 来源章节 | 状态 |
|------|---------|------|
| 多轮对话 | Ch1 | ✓ |
| 工具调用 | Ch2-Ch3 | ✓ (6个工具) |
| 流式输出 | Ch4 | ✓ |
| System Prompt | Ch5 | ✓ |
| 上下文管理 | Ch6 | ✓ (截断+压缩) |
| 权限确认 | Ch7 | ✓ |
| 子智能体 | Ch8 | ✓ |
| CLI 参数 | Ch9 | ✓ |

## 与真实 Claude Code 对比

| 方面 | 本章 | Claude Code |
|------|------|-------------|
| 代码量 | ~2000 行 | ~50000 行 |
| 工具数 | 7 | 15+ |
| MCP 协议 | 无 | 支持 |
| IDE 集成 | 无 | VS Code 等 |
| 配置继承 | 无 | AGENTS.md 机制 |
| 插件系统 | 无 | 支持 |
| 并行子 Agent | 无 | 最多 10 个 |

**但核心架构完全同构**：Agent Loop + 工具系统 + 上下文管理 + 权限 + 子智能体。理解了这个 2000 行的版本，就能理解 Claude Code 的架构设计。

## 恭喜

你已经从 50 行的最小 CLI 走到了 2000 行的完整 Agent。回顾一下你理解了什么：

1. **Agent Loop** — 两层循环，外层等用户，内层跑工具
2. **tool_use 协议** — 模型请求 → 代码执行 → 结果回传
3. **流式输出** — 逐 token 推送，碎片拼接
4. **System Prompt** — 规则注入，约束行为
5. **上下文管理** — token 计数，截断，压缩
6. **权限系统** — 安全 gate，危险检测
7. **子智能体** — 独立循环，上下文隔离

这些就是所有 AI Agent 产品的通用骨架。