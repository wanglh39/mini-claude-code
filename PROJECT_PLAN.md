# Mini Claude Code — 项目蓝图

> 从零实现一个 Claude Code 复刻，理解其设计哲学与底层原理。
> 教学向，递进式，TypeScript + Anthropic API，每章独立可运行。

---

## 1. 项目定位

### 是什么

一个 **教学项目**，用 10 个递进章节（Ch0→Ch9），从 50 行最小 CLI 到 2000 行完整工具，逐步复刻 Claude Code 的核心能力。

### 为什么

Claude Code 不是一个简单的"套壳 API"。它是一个 **Agent Loop（智能体循环）** 架构，涉及：
- LLM 工具调用协议（tool_use）
- 流式事件处理
- System Prompt 工程
- 上下文窗口管理
- 权限与安全边界
- 子智能体编排

这些是所有 AI Agent 产品的通用骨架。理解了 Claude Code，就理解了 Agent 的本质。

### 给谁看

- 想理解 AI Agent 内部原理的开发者
- 想自己构建 Agent 产品的工程师
- 对 Claude Code 设计哲学感兴趣的人

### 不是什么

- 不是生产级工具（简化了错误处理、并发、MCP 等）
- 不是 Claude Code 的完整复刻（只复刻核心架构）
- 不追求功能对等（追求原理对齐）

---

## 2. 技术栈

| 层面 | 选型 | 理由 |
|------|------|------|
| 语言 | TypeScript | 贴近 Claude Code 原版，可直接对比源码 |
| 运行时 | Node.js ≥ 20 | 通用稳定 |
| 直接运行 | `tsx` | 免编译，`npx tsx main.ts` 即跑 |
| LLM SDK | `@anthropic-ai/sdk` | 官方 SDK，tool_use 协议与原版一致 |
| CLI 交互 | Node 原生 `readline` | 零依赖，理解底层 |
| 终端样式 | 原生 ANSI escape | 零依赖，教学向 |
| 文档站 | MkDocs Material | Python 生态，中文搜索好，主题美观 |
| 部署 | GitHub Pages + Actions | push 即部署 |
| 包管理 | npm | 最通用 |

### API 后端可切换

通过环境变量切换，代码零改动：

```env
# Anthropic 官方（默认）
API_KEY=sk-ant-xxx
MODEL=claude-sonnet-4-20250514

# DeepSeek（Anthropic 兼容格式，国内低成本）
API_KEY=sk-xxx
BASE_URL=https://api.deepseek.com/anthropic
MODEL=deepseek-chat
```

SDK 初始化时读取环境变量，自动适配：
```typescript
const client = new Anthropic({
  apiKey: process.env.API_KEY,
  baseURL: process.env.BASE_URL,  // undefined 时用官方默认
});
```

---

## 3. 目录结构

```
mini-claude-code/
├── README.md                              # 项目总览
├── PROJECT_PLAN.md                        # 本文档
├── .gitignore
├── tsconfig.base.json                     # 共享 TS 配置
│
├── lessons/                               # 每章独立可运行
│   ├── ch01-minimal/
│   │   ├── README.md                      # 本章原理 + 运行说明
│   │   ├── main.ts                        # 全部代码
│   │   ├── package.json
│   │   └── .env.example
│   │
│   ├── ch02-tools-basic/
│   │   ├── README.md
│   │   ├── main.ts                        # Agent loop（含工具循环）
│   │   ├── tools.ts                       # Read/Write 工具
│   │   ├── package.json
│   │   └── .env.example
│   │
│   ├── ch03-tools-full/
│   │   ├── README.md
│   │   ├── main.ts
│   │   ├── tools/
│   │   │   ├── index.ts                   # 工具注册表
│   │   │   ├── read.ts
│   │   │   ├── write.ts
│   │   │   ├── edit.ts
│   │   │   ├── bash.ts
│   │   │   ├── glob.ts
│   │   │   └── grep.ts
│   │   ├── package.json
│   │   └── .env.example
│   │
│   ├── ch04-streaming/
│   │   ├── README.md
│   │   ├── main.ts
│   │   ├── tools/
│   │   ├── package.json
│   │   └── .env.example
│   │
│   ├── ch05-system-prompt/
│   │   ├── README.md
│   │   ├── main.ts
│   │   ├── tools/
│   │   ├── prompts/
│   │   │   └── system.ts                 # System prompt 生成器
│   │   ├── package.json
│   │   └── .env.example
│   │
│   ├── ch06-context/
│   │   ├── README.md
│   │   ├── main.ts
│   │   ├── tools/
│   │   ├── prompts/
│   │   ├── context.ts                    # 上下文管理器
│   │   ├── package.json
│   │   └── .env.example
│   │
│   ├── ch07-permission/
│   │   ├── README.md
│   │   ├── main.ts
│   │   ├── tools/
│   │   ├── prompts/
│   │   ├── context.ts
│   │   ├── permission.ts                 # 权限系统
│   │   ├── package.json
│   │   └── .env.example
│   │
│   ├── ch08-subagent/
│   │   ├── README.md
│   │   ├── main.ts
│   │   ├── tools/
│   │   ├── prompts/
│   │   ├── context.ts
│   │   ├── permission.ts
│   │   ├── subagent.ts                   # 子智能体
│   │   ├── package.json
│   │   └── .env.example
│   │
│   └── ch09-final/
│       ├── README.md
│       ├── src/
│       │   ├── main.ts                   # 入口
│       │   ├── cli.ts                    # CLI 参数解析
│       │   ├── agent-loop.ts             # 核心循环
│       │   ├── tools/
│       │   ├── prompts/
│       │   ├── context.ts
│       │   ├── permission.ts
│       │   ├── subagent.ts
│       │   └── config.ts                 # 配置管理
│       ├── package.json
│       └── .env.example
│
├── docs/                                  # MkDocs 文档站
│   ├── mkdocs.yml                         # MkDocs 配置
│   └── docs/
│       ├── index.md                       # 首页
│       ├── architecture.md                # Ch0 架构原理拆解
│       ├── ch01.md                        # 各章文档
│       ├── ch02.md
│       ├── ...
│       ├── ch09.md
│       ├── comparison.md                  # 与真实 Claude Code 全面对比
│       └── assets/
│           └── agent-loop.svg             # 架构图
│
└── .github/
    └── workflows/
        └── deploy-docs.yml                # GitHub Pages 自动部署
```

### 目录设计原则

1. **每章独立**：`cd lessons/ch01-minimal && npx tsx main.ts` 直接跑，不依赖其他章
2. **渐进复制**：后一章复制前一章代码再加新功能，而非引用。学习者每章都是完整的
3. **文档与代码分离**：`lessons/` 放代码，`docs/` 放文档站，`lessons/*/README.md` 是章节内的精简说明

---

## 4. 每章详细大纲

### Ch0: 架构原理拆解（纯文档，0 行代码）

**目标**：不写代码，建立心智模型。理解 Claude Code 的本质。

**核心知识点**：

1. **Claude Code 的本质是 Agent Loop**
   ```
   用户输入 → 构造请求 → LLM → 有工具调用？
                                ├─ 是 → 执行工具 → 结果加入对话 → 回到 LLM
                                └─ 否 → 输出文本 → 等待下一轮用户输入
   ```

2. **tool_use 协议**
   - 请求侧：`tools` 参数定义工具 schema（JSON Schema）
   - 响应侧：`content` 中出现 `type: "tool_use"` block
   - 回传侧：`type: "tool_result"` 消息，带 `tool_use_id` 关联
   - 循环：`stop_reason: "tool_use"` 表示模型想调工具，`"end_turn"` 表示说完了

3. **事件流模型**（streaming）
   - `message_start` → `content_block_start` → `content_block_delta`(多个) → `content_block_stop` → `message_stop`
   - 文本块：`text_delta`
   - 工具块：`input_json_delta`（工具参数流式传入）

4. **System Prompt 的角色**
   - 不是"提示词"，是"规则注入"
   - 定义模型身份、工具使用规则、安全约束、环境信息

5. **上下文窗口**
   - 200K token 限制
   - 超限策略：截断旧消息 / 压缩历史
   - 工具结果可能很大，需要截断

6. **权限模型**
   - 工具执行前的确认 gate
   - 读操作可自动批准，写/执行操作需确认
   - 工作目录边界限制

7. **子智能体**
   - Task 工具 spawn 独立 agent loop
   - 独立 messages 数组（隔离上下文）
   - 结果回传给父 agent

**产出**：
- `docs/docs/architecture.md` — 完整架构文档
- Agent Loop 流程图（SVG）
- 伪代码骨架

---

### Ch1: 最小可对话 CLI（~50 行）

**目标**：跑通 Anthropic SDK 调用，实现多轮对话 CLI。

**核心知识点**：
1. `@anthropic-ai/sdk` 安装与初始化
2. `client.messages.create()` 基本调用
3. `messages` 数组管理（多轮对话的核心数据结构）
4. Node.js `readline` 异步交互
5. 环境变量配置（API Key、baseURL、model）
6. `stop_reason` 的含义

**代码结构**：
```
ch01-minimal/
├── README.md
├── main.ts          # ~50 行，全部逻辑在一个文件
├── package.json
└── .env.example
```

**main.ts 骨架**：
```typescript
import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";
import * as dotenv from "dotenv";

dotenv.config();

const client = new Anthropic({
  apiKey: process.env.API_KEY,
  baseURL: process.env.BASE_URL,
});

const model = process.env.MODEL || "claude-sonnet-4-20250514";
const messages: Anthropic.MessageParam[] = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log("Mini Claude Code - Ch1 (minimal)\n");

  while (true) {
    const userInput = await prompt("\n> ");
    if (userInput === "exit") break;

    messages.push({ role: "user", content: userInput });

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages,
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    messages.push({ role: "assistant", content: response.content });
    console.log(text);
  }

  rl.close();
}

main();
```

**与原版对比**：
- 原版有 tools、streaming、system prompt、context、permission...
- 本章只有裸对话，但这 50 行就是整个 Agent Loop 的骨架
- 原版的 `query()` 函数本质就是这个循环的增强版

---

### Ch2: 加 2 个工具 — Read/Write（~150 行）

**目标**：理解 tool_use 协议，让模型能读写文件。这是从"聊天机器人"到"Agent"的质变。

**核心知识点**：
1. 工具定义 schema：`name` + `description` + `input_schema`（JSON Schema）
2. `tools` 参数传入 `messages.create()`
3. 响应中的 `tool_use` content block
4. 构造 `tool_result` 消息回传
5. **内层 agentic loop**：工具调用可能连续多轮（模型调一个工具看结果，再调下一个）
6. `stop_reason === "tool_use"` vs `"end_turn"` 的分支

**代码结构**：
```
ch02-tools-basic/
├── README.md
├── main.ts          # Agent loop（含内层工具循环）
├── tools.ts         # 工具定义 + 执行函数
├── package.json
└── .env.example
```

**核心结构**：
```typescript
// tools.ts — 工具定义
export const tools: Anthropic.Tool[] = [
  {
    name: "read_file",
    description: "读取指定路径文件的内容",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "文件路径" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "将内容写入指定路径的文件",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "文件路径" },
        content: { type: "string", description: "文件内容" },
      },
      required: ["path", "content"],
    },
  },
];

// 工具执行
export function executeTool(name: string, input: any): string {
  switch (name) {
    case "read_file":
      return fs.readFileSync(input.path, "utf-8");
    case "write_file":
      fs.writeFileSync(input.path, input.content, "utf-8");
      return `已写入 ${input.path}`;
    default:
      return `未知工具: ${name}`;
  }
}
```

```typescript
// main.ts — 内层 agentic loop（关键！）
while (true) {
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    messages,
    tools,           // ← 传入工具定义
  });

  messages.push({ role: "assistant", content: response.content });

  if (response.stop_reason === "tool_use") {
    // 模型想调工具 → 执行 → 结果回传 → 继续循环
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        console.log(`  [工具] ${block.name}(${JSON.stringify(block.input)})`);
        const result = executeTool(block.name, block.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
    }
    messages.push({ role: "user", content: toolResults });
    // ← 不 break，继续循环，让模型看到工具结果后决定下一步
  } else {
    // stop_reason === "end_turn"，模型说完了
    const text = extractText(response);
    console.log(text);
    break;  // ← 回到外层等待用户输入
  }
}
```

**与原版对比**：
- 原版工具系统有权限检查、参数校验、错误处理、超时控制
- 本章直接执行，无保护，但核心循环完全一致
- 原版工具是类（class），有 `validate()`、`checkPermissions()`、`execute()` 方法
- 本章是函数 + switch，简化但等价

---

### Ch3: 完整工具集 — Edit/Bash/Glob/Grep（~400 行）

**目标**：实现剩余核心工具，真正能干活——读写编辑文件、执行命令、搜索代码。

**新增知识点**：
1. **Edit 工具**：精确字符串替换（`oldString` → `newString`），需处理多匹配错误
2. **Bash 工具**：`child_process.exec`，超时、stdout/stderr 捕获
3. **Glob 工具**：文件模式匹配（`**/*.ts`），用 `fast-glob` 或手写递归
4. **Grep 工具**：正则内容搜索，返回匹配行 + 行号
5. **工具模块化**：每个工具一个文件，统一注册
6. **错误处理**：工具执行失败时返回错误信息给模型

**代码结构**：
```
ch03-tools-full/
├── main.ts
├── tools/
│   ├── index.ts       # 工具注册表 + 统一执行入口
│   ├── read.ts        # ReadFile
│   ├── write.ts       # WriteFile
│   ├── edit.ts        # Edit（精确替换）
│   ├── bash.ts        # Bash（执行命令）
│   ├── glob.ts        # Glob（文件搜索）
│   └── grep.ts        # Grep（内容搜索）
├── package.json
└── .env.example
```

**各工具要点**：

| 工具 | input_schema 关键字段 | 实现要点 |
|------|----------------------|----------|
| `read_file` | `path` | `fs.readFileSync`，大文件截断 |
| `write_file` | `path`, `content` | `fs.writeFileSync` |
| `edit_file` | `path`, `oldString`, `newString` | 读取→替换→写入，检查唯一匹配 |
| `bash` | `command`, `timeout?` | `child_process.exec`，默认超时 120s |
| `glob` | `pattern`, `path?` | 递归匹配，按修改时间排序 |
| `grep` | `pattern`, `include?` | 逐文件正则匹配，返回行号+内容 |

**与原版对比**：
- 原版每个工具有丰富的参数（如 Read 有 `offset`、`limit`）
- 原版 Bash 有工作目录、环境变量注入
- 本章实现核心功能，参数从简

---

### Ch4: 流式输出（~600 行）

**目标**：从 `messages.create()` 切换到 `messages.stream()`，体验接近真实 Claude Code。

**新增知识点**：
1. `client.messages.stream()` API
2. 流式事件类型：
   - `message_start` — 消息开始，含 `usage` 初始值
   - `content_block_start` — 某个 content block 开始（text 或 tool_use）
   - `content_block_delta` — block 增量（`text_delta` 或 `input_json_delta`）
   - `content_block_stop` — block 结束
   - `message_delta` — 消息级增量（含 `stop_reason`）
   - `message_stop` — 消息结束
3. `text_delta` 实时输出到终端
4. `input_json_delta` 拼接工具参数 JSON
5. 流式下组装完整 `response.content` 用于 messages 数组
6. 终端渲染：工具调用时显示 `[工具] name(...)`，完成后显示结果

**核心结构**：
```typescript
const stream = client.messages.stream({
  model,
  max_tokens: 4096,
  messages,
  tools,
});

for await (const event of stream) {
  switch (event.type) {
    case "content_block_delta":
      if (event.delta.type === "text_delta") {
        process.stdout.write(event.delta.text);  // 实时输出文本
      } else if (event.delta.type === "input_json_delta") {
        // 拼接工具参数 JSON
        toolInputBuffers[event.index] += event.delta.partial_json;
      }
      break;
    case "content_block_start":
      if (event.content_block.type === "tool_use") {
        console.log(`\n  [工具] ${event.content_block.name}...`);
      }
      break;
    // ...
  }
}

const finalMessage = await stream.finalMessage();
messages.push({ role: "assistant", content: finalMessage.content });
```

**与原版对比**：
- 原版有复杂的终端渲染（颜色、spinner、进度条、diff 视图）
- 本章用原生 ANSI escape 做基本着色
- 流式事件处理逻辑与原版一致

---

### Ch5: System Prompt 工程（~800 行）

**目标**：设计 system prompt，让模型行为从"随机"变成"合理"。

**新增知识点**：
1. System prompt 的结构层次：
   ```
   1. 身份定义（你是谁）
   2. 工具使用规则（怎么用工具）
   3. 代码风格约束（怎么写代码）
   4. 安全约束（什么不能做）
   5. 环境信息（cwd, git, os, date）
   ```
2. 动态注入环境信息：`process.cwd()`, `git status`, `process.platform`, 日期
3. 工具使用规则编写：何时用 Read vs Grep，何时用 Edit vs Write
4. prompt 对模型行为的影响实验（同一问题，有无 system prompt 的差异）
5. prompt 的"约束力"来源：模型对指令的遵循度

**代码结构**：
```
ch05-system-prompt/
├── main.ts
├── tools/
├── prompts/
│   └── system.ts      # System prompt 生成器
├── package.json
└── .env.example
```

**system.ts 骨架**：
```typescript
import { execSync } from "child_process";

export function buildSystemPrompt(): string {
  const cwd = process.cwd();
  const platform = process.platform;
  const date = new Date().toISOString().split("T")[0];

  let gitInfo = "";
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd })
      .toString().trim();
    gitInfo = `当前 Git 分支: ${branch}`;
  } catch {
    gitInfo = "非 Git 仓库";
  }

  return `你是一个代码助手，帮助用户完成软件工程任务。

## 工具使用规则
- 读取单个文件用 read_file，搜索代码用 grep
- 修改文件优先用 edit_file（精确替换），新建文件用 write_file
- 执行命令前思考是否必要，避免破坏性操作

## 代码风格
- 不添加多余注释
- 遵循项目现有代码风格

## 环境信息
- 工作目录: ${cwd}
- 操作系统: ${platform}
- 日期: ${date}
- ${gitInfo}
`;
}
```

**与原版对比**：
- 原版 system prompt 有数千字，极其详细
- 原版会根据项目类型（npm/cargo/go）注入不同规则
- 原版有 AGENTS.md 机制（项目级 prompt 覆盖）
- 本章实现核心结构，展示 prompt 工程的基本方法

---

### Ch6: 上下文管理（~1000 行）

**目标**：处理 200K token 限制，支持长对话不崩。

**新增知识点**：
1. Token 计数：API 返回 `usage.input_tokens` / `output_tokens`
2. 上下文窗口限制：Claude 200K，DeepSeek 64K-128K
3. 消息截断策略：保留 system + 最近 N 轮，丢弃旧消息
4. 对话压缩：当接近限制时，用模型总结旧对话，替换历史
5. 工具结果截断：大输出（如读大文件）截断到合理长度
6. 上下文状态监控：实时显示 `当前 token / 限制`

**代码结构**：
```
ch06-context/
├── main.ts
├── tools/
├── prompts/
├── context.ts        # 上下文管理器
├── package.json
└── .env.example
```

**context.ts 核心接口**：
```typescript
export class ContextManager {
  private messages: MessageParam[] = [];
  private maxTokens: number;

  addMessage(msg: MessageParam) { ... }

  getTokenCount(): number {
    // 累加 usage 或用 tokenizer 估算
  }

  isNearLimit(): boolean {
    return this.getTokenCount() > this.maxTokens * 0.8;
  }

  async compress(): Promise<void> {
    // 用模型总结旧消息，替换历史
  }

  truncateToolResult(result: string): string {
    // 超长结果截断 + 提示
  }

  getMessages(): MessageParam[] {
    return this.messages;
  }
}
```

**与原版对比**：
- 原版有 `compactConversation` 机制，用特殊 prompt 让模型总结
- 原版有 `tokenCount` 精确计数（用 tokenizer 库）
- 原版工具结果有智能截断（保留头尾，省略中间）
- 本章实现基本截断 + 压缩策略

---

### Ch7: 权限与安全（~1200 行）

**目标**：工具执行前的确认 gate，防止模型干坏事。

**新增知识点**：
1. 权限层级：`auto-approve` / `confirm` / `deny`
2. 工具分类：
   - 安全（Read, Glob, Grep）→ 自动批准
   - 危险（Write, Edit, Bash）→ 需确认
3. Bash 命令确认：显示命令，用户 y/n
4. 文件写入确认：显示路径，用户 y/n
5. 危险命令检测：`rm -rf`, `git push --force` 等
6. 工作目录边界：拒绝访问 `../` 外的路径
7. `--auto-approve` 模式：跳过所有确认（危险但方便）

**代码结构**：
```
ch07-permission/
├── main.ts
├── tools/
├── prompts/
├── context.ts
├── permission.ts     # 权限系统
├── package.json
└── .env.example
```

**permission.ts 核心接口**：
```typescript
export class PermissionManager {
  private autoApprove: boolean;

  async checkTool(toolName: string, input: any): Promise<boolean> {
    if (this.autoApprove) return true;

    const safeTools = ["read_file", "glob", "grep"];
    if (safeTools.includes(toolName)) return true;

    // 危险工具 → 确认
    const desc = this.describeAction(toolName, input);
    const answer = await prompt(`即将执行: ${desc}\n允许? (y/n) `);
    return answer.toLowerCase() === "y";
  }

  private describeAction(toolName: string, input: any): string {
    switch (toolName) {
      case "bash": return `命令: ${input.command}`;
      case "write_file": return `写入: ${input.path}`;
      case "edit_file": return `编辑: ${input.path}`;
      // ...
    }
  }
}
```

**与原版对比**：
- 原版有 `permission` 模块，支持细粒度规则
- 原版有 `allowedTools` / `deniedTools` 配置
- 原版 Bash 有命令解析 + 危险模式匹配
- 本章实现基本确认 gate + 危险命令检测

---

### Ch8: 子智能体（~1500 行）

**目标**：实现 Task 工具，能 spawn 子 agent 处理子任务。

**新增知识点**：
1. Task 工具定义：`description` + `prompt` + `subagent_type`
2. 子 agent 循环：独立 messages 数组，独立上下文
3. 子 agent 工具集：可限制（如只给搜索工具，不给写工具）
4. 结果回传：子 agent 的最终输出作为 tool_result 返回父 agent
5. 串行执行（本章不实现并行，保持简单）
6. Agent 编排模式：父 agent 决策"做什么"，子 agent 执行"怎么做"

**代码结构**：
```
ch08-subagent/
├── main.ts
├── tools/
├── prompts/
├── context.ts
├── permission.ts
├── subagent.ts       # 子智能体
├── package.json
└── .env.example
```

**subagent.ts 核心结构**：
```typescript
export async function runSubagent(
  prompt: string,
  tools: Tool[],
  systemPrompt: string
): Promise<string> {
  // 独立 messages 数组
  const subMessages: MessageParam[] = [
    { role: "user", content: prompt },
  ];

  // 独立 agent loop
  while (true) {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: subMessages,
      tools,
    });

    subMessages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "tool_use") {
      // 执行工具（用子 agent 的工具集）
      const results = await executeTools(response, tools);
      subMessages.push({ role: "user", content: results });
    } else {
      // 子 agent 完成，返回最终文本
      return extractText(response);
    }
  }
}
```

**与原版对比**：
- 原版 Task 工具支持多种 subagent_type（explore, general, code-reviewer...）
- 原版子 agent 有独立 system prompt、独立工具集、独立权限
- 原版支持并行 spawn（最多 10 个）
- 本章实现串行单子 agent，展示编排本质

---

### Ch9: 整合打包（~2000 行）

**目标**：将前 8 章整合成完整 CLI 工具，可 `npx` 调用。

**新增知识点**：
1. CLI 参数解析（`--model`, `--auto-approve`, `--help`）
2. 配置文件（`.miniclaudecode.json`）
3. 帮助信息与版本号
4. 优雅退出（Ctrl+C 处理）
5. 错误边界（API 错误、网络错误、工具错误）
6. 项目结构整理（src/ 目录组织）

**代码结构**：
```
ch09-final/
├── src/
│   ├── main.ts           # 入口：解析参数 → 启动
│   ├── cli.ts            # CLI 参数解析
│   ├── config.ts         # 配置加载（env + args + config file）
│   ├── agent-loop.ts     # 核心循环（整合 Ch1-Ch8）
│   ├── tools/            # 完整工具集
│   ├── prompts/          # System prompt
│   ├── context.ts        # 上下文管理
│   ├── permission.ts     # 权限系统
│   └── subagent.ts       # 子智能体
├── package.json          # bin 字段 → npx 可调用
└── .env.example
```

**package.json bin 字段**：
```json
{
  "name": "mini-claude-code",
  "bin": {
    "mini-claude-code": "./src/main.ts"
  },
  "scripts": {
    "start": "tsx src/main.ts",
    "dev": "tsx watch src/main.ts"
  }
}
```

**与原版对比**：
- 原版有 MCP 协议、插件系统、IDE 集成、配置继承...
- 本章是一个完整但精简的 CLI，覆盖核心 Agent Loop 全链路
- 原版 ~50K 行，本章 ~2K 行，但架构同构

---

## 5. 里程碑与开发顺序

| 里程碑 | 内容 | 验证标准 |
|--------|------|----------|
| **M0** | 项目蓝图 + 基础结构 | 本文档 + README + .gitignore + tsconfig |
| **M1** | Ch0 + Ch1 | 架构文档 + 最小 CLI 能对话 |
| **M2** | Ch2 + Ch3 | 工具系统完整，能读写编辑执行搜索 |
| **M3** | Ch4 + Ch5 | 流式输出 + system prompt，体验接近真实 |
| **M4** | Ch6 + Ch7 | 上下文管理 + 权限确认，健壮性达标 |
| **M5** | Ch8 + Ch9 | 子智能体 + 整合打包，完整成品 |
| **M6** | 文档站 + 部署 | MkDocs 站点上线 GitHub Pages |

### 开发顺序

```
M0 → M1 → M2 → M3 → M4 → M5 → M6
     ↓     ↓     ↓     ↓     ↓
   验证   验证  验证  验证  验证
```

每个里程碑完成后：
1. 实际运行验证功能
2. 更新对应文档
3. git commit（用户确认后）

---

## 6. 文档站方案

### 工具：MkDocs Material

```yaml
# docs/mkdocs.yml
site_name: Mini Claude Code — 从零理解 Agent 架构
theme:
  name: material
  language: zh
  features:
    - navigation.tabs
    - navigation.sections
    - search.suggest
    - content.code.copy
  palette:
    - scheme: default
      primary: indigo
      toggle:
        icon: material/brightness-7
        name: 切换暗色模式
    - scheme: slate
      primary: indigo
      toggle:
        icon: material/brightness-4
        name: 切换亮色模式

nav:
  - 首页: index.md
  - 架构原理: architecture.md
  - 第一章 - 最小CLI: ch01.md
  - 第二章 - 工具系统: ch02.md
  - 第三章 - 完整工具集: ch03.md
  - 第四章 - 流式输出: ch04.md
  - 第五章 - System Prompt: ch05.md
  - 第六章 - 上下文管理: ch06.md
  - 第七章 - 权限安全: ch07.md
  - 第八章 - 子智能体: ch08.md
  - 第九章 - 整合打包: ch09.md
  - 与原版对比: comparison.md

markdown_extensions:
  - pymdownx.highlight:
      anchor_linenums: true
  - pymdownx.superfences
  - pymdownx.tabbed:
      alternate_style: true
  - admonition
  - pymdownx.details
```

### 部署：GitHub Actions

```yaml
# .github/workflows/deploy-docs.yml
name: Deploy Docs
on:
  push:
    branches: [main]
    paths: [docs/**]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install mkdocs-material
      - run: mkdocs build
        working-directory: docs
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: docs/site
```

---

## 7. 每章文档结构模板

每个 `lessons/chXX-xxx/README.md` 和 `docs/docs/chXX.md` 遵循统一结构：

```markdown
# 第 X 章：标题

## 目标
本章要解决什么问题，达到什么效果。

## 核心原理
### 概念 1
原理讲解 + 图示

### 概念 2
...

## 代码实现
### 文件结构
### 关键代码逐行讲解

## 运行方式
cd lessons/chXX-xxx
cp .env.example .env  # 填入 API Key
npx tsx main.ts

## 与真实 Claude Code 对比
| 方面 | 本章实现 | 原版实现 |
|------|---------|---------|
| ...  | ...     | ...     |

简化了什么、为什么简化、原版多做了什么。

## 下一章预告
本章的不足，下一章要解决什么。
```

---

## 8. .env.example 模板

所有章节共用：

```env
# === LLM API 配置 ===

# API Key（必填）
# Anthropic: sk-ant-xxx
# DeepSeek:  sk-xxx
API_KEY=

# 可选：切换 API 后端
# 留空 = Anthropic 官方
# DeepSeek: https://api.deepseek.com/anthropic
BASE_URL=

# 模型名称（必填）
# Anthropic: claude-sonnet-4-20250514
# DeepSeek:  deepseek-chat
MODEL=claude-sonnet-4-20250514

# 可选：最大 token 数
MAX_TOKENS=4096
```

---

## 9. GitHub 仓库规划

### 仓库名
`mini-claude-code`

### README.md 结构
```
# Mini Claude Code

> 从零实现 Claude Code，理解 Agent 架构本质

## 快速开始
## 章节目录
## 技术栈
## 文档站链接
## 致谢
```

### .gitignore 要点
```
node_modules/
.env
*.log
docs/site/       # MkDocs 构建产物
```

---

## 10. 设计决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 语言 | TypeScript | 贴近原版，可对比源码 |
| API | Anthropic SDK | tool_use 协议原汁原味 |
| API 后端 | 可切换（Anthropic/DeepSeek） | 降低门槛，国内可用 |
| 直接运行 | tsx | 免编译，教学向最简 |
| CLI 交互 | readline 原生 | 零依赖，理解底层 |
| 文档站 | MkDocs Material | 中文搜索好，主题美观 |
| 源码对比 | 讲原理 + 伪代码 | 不贴混淆代码 |
| 每章组织 | 独立目录，渐进复制 | 每章可独立运行 |
| Mock 模式 | 不做 | DeepSeek 已解决门槛问题 |
| 并行子 agent | 不做 | 保持简单，串行即可展示编排本质 |