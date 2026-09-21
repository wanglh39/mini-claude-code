# 第八章：子智能体

> Agent 里的 Agent。通过 Task 工具 spawn 子 Agent 处理子任务。

## 目标

理解子智能体的概念、独立上下文、工具集限制和 agent 编排模式。

## 核心原理

### 什么是子智能体

子智能体是 **Agent 里的 Agent**。父 Agent 通过 `task` 工具 spawn 一个子 Agent：

```
父 Agent: "帮我找一下项目里所有处理错误的代码"
  → 调用 task 工具
    → spawn 子 Agent（独立 messages 数组）
      → 子 Agent 自主搜索（grep, read_file, ...）
      → 子 Agent 完成搜索，返回结果文本
  ← 父 Agent 收到结果，继续工作
```

### 为什么要子智能体

1. **上下文隔离**：子任务的工具调用结果不污染父 Agent 的上下文
   - 比如子 Agent 读了 10 个文件，这些内容不进入父 Agent 的 messages
   - 父 Agent 只看到子 Agent 的最终总结

2. **工具限制**：给子 Agent 限制工具集
   - 比如只给搜索工具，不给写工具 → 子 Agent 只能看不能改

3. **专注性**：子 Agent 有自己的 system prompt，更专注

### 实现本质

子智能体就是一个**独立的 agent loop**：

```typescript
async function executeTask(input) {
  const subMessages = [{ role: "user", content: input.prompt }];

  while (true) {  // 独立的内层循环
    const response = await client.messages.create({
      system: SUBAGENT_SYSTEM_PROMPT,  // 独立 system prompt
      messages: subMessages,            // 独立 messages
      tools: subTools,                  // 独立工具集（不含 task，防递归）
    });

    if (response.stop_reason === "tool_use") {
      // 执行工具，结果加入 subMessages
    } else {
      // 子 Agent 完成，返回最终文本
      return extractText(response);
    }
  }
}
```

**关键**：`subMessages` 是局部变量，与父 Agent 的 `messages` 完全隔离。子 Agent 结束后，只有最终文本作为 `tool_result` 返回给父 Agent。

### 防递归

子 Agent 的工具集排除了 `task` 工具：

```typescript
const subTools = tools.filter(t => t.name !== "task");
```

否则子 Agent 可以 spawn 子子 Agent，无限递归。

## 代码结构

```
ch08-subagent/
├── main.ts
├── tools/
├── prompts/
├── context.ts
├── permission.ts
├── subagent.ts       # 子智能体
└── .env.example
```

### subagent.ts

```typescript
export const taskTool: Tool = {
  name: "task",
  description: "启动子智能体处理子任务",
  input_schema: {
    properties: {
      description: { type: "string" },  // 简短描述
      prompt: { type: "string" },        // 详细任务指令
    }
  }
};

export async function executeTask(client, model, input) {
  // 独立 messages 数组
  const subMessages = [{ role: "user", content: input.prompt }];

  // 独立 agent loop
  while (true) {
    const response = await client.messages.create({
      system: SUBAGENT_SYSTEM_PROMPT,
      messages: subMessages,
      tools: subTools,  // 不含 task
    });

    if (response.stop_reason === "tool_use") {
      // 执行工具
    } else {
      return extractText(response);  // 返回最终文本
    }
  }
}
```

### main.ts 的变化

工具列表加入 `taskTool`，工具执行时特殊处理 `task`：

```typescript
if (block.name === "task") {
  const result = await executeTask(client, model, block.input, perm);
  toolResults.push({
    type: "tool_result",
    tool_use_id: block.id,
    content: result,  // 子 Agent 的最终文本
  });
  continue;
}
```

## 运行方式

```bash
cd lessons/ch08-subagent
npm install
cp .env.example .env
npx tsx main.ts
```

试试：
- "帮我搜索项目里所有的 TypeScript 文件，然后总结项目结构"
  - 模型可能 spawn 子 Agent 做搜索，父 Agent 做总结

## 与真实 Claude Code 对比

| 方面 | 本章 | Claude Code |
|------|------|-------------|
| subagent_type | 无分类 | explore, general, code-reviewer 等 |
| 并行 | 串行 | 支持最多 10 个并行 |
| 工具集 | 排除 task | 按 subagent_type 配置不同工具集 |
| system prompt | 通用 | 按 subagent_type 定制 |
| 上下文限制 | 20 次迭代 | 有 token 限制 + 压缩 |

Claude Code 的子智能体系统更复杂，支持多种类型的子 Agent（探索型、通用型、代码审查型等），每种有不同的工具集和 system prompt。本章展示的是编排本质。

## 下一章预告

所有核心功能都实现了。最后一章把前 8 章整合成完整 CLI 工具，加参数解析和配置管理，可以 `npx` 调用。