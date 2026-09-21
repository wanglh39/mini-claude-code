# 第一章：最小可对话 CLI

> 50 行代码，跑通 Anthropic SDK 调用，实现多轮对话。
> 这是整个 Agent Loop 的最简骨架——没有工具、没有流式、没有 system prompt。

## 目标

理解三件事：
1. **Anthropic SDK 怎么调** — `client.messages.create()`
2. **多轮对话的本质** — 一个 `messages` 数组，每次把 user 和 assistant 消息追加进去
3. **Agent Loop 的外层** — `while (true)` 等待用户输入，调 API，输出结果

## 核心原理

### 多轮对话 = 累积 messages 数组

大模型 API 是**无状态**的。每次调用，服务端不记得上一次说了什么。所谓"多轮对话"，就是把历史对话完整地放在 `messages` 数组里，每次请求都带上：

```typescript
const messages = [];

// 第一轮
messages.push({ role: "user", content: "你好" });
const resp1 = await client.messages.create({ model, messages });
messages.push({ role: "assistant", content: resp1.content });

// 第二轮 — messages 里已经有第一轮的完整历史
messages.push({ role: "user", content: "刚才我说了什么？" });
const resp2 = await client.messages.create({ model, messages });
// 模型能回答"你说了你好"，因为它看到了 messages 里的历史
```

**这就是所有 LLM 聊天应用的底层原理。** ChatGPT、Claude、Claude Code，都是这么做的。

### Agent Loop 的两层结构

Claude Code 的循环其实有两层：

```
外层循环（用户交互）:
  while True:
    user_input = 等待用户输入
    messages.append(user_input)
    
    内层循环（工具调用）:        ← Ch2 才加，本章没有
      response = 调用 LLM
      if 模型想调工具:
        执行工具，结果加入 messages
        继续循环
      else:
        输出文本
        break  ← 回到外层等用户
```

本章只有外层循环。**内层循环是 Ch2 的核心**，那是从"聊天机器人"变成"Agent"的关键。

## 代码逐行讲解

```typescript
// ① 初始化 SDK 客户端
const client = new Anthropic({
  apiKey: process.env.API_KEY,
  baseURL: process.env.BASE_URL || undefined,  // 留空用官方，填了切 DeepSeek
});

// ② messages 数组 — 整个对话的"记忆"
const messages: Anthropic.MessageParam[] = [];

// ③ readline — Node.js 内置的命令行交互
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// ④ 外层循环
while (true) {
  const userInput = await prompt("\n> ");      // 等用户说话
  messages.push({ role: "user", content: userInput });  // 加入历史

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages,  // ← 带上完整历史
  });

  messages.push({ role: "assistant", content: response.content });  // 加入历史
  console.log(text);  // 输出给用户
}
```

**关键洞察**：`messages` 数组是这个程序的**唯一状态**。整个对话的"记忆"就在这一个变量里。后续所有章节的复杂功能，本质上都是在操作这个数组。

## 运行方式

```bash
cd lessons/ch01-minimal
npm install
cp .env.example .env
# 编辑 .env，填入 API_KEY
npx tsx main.ts
```

## 与真实 Claude Code 对比

| 方面 | 本章 | Claude Code |
|------|------|-------------|
| 工具调用 | 无 | 10+ 个工具 |
| 流式输出 | 无（等全部生成） | 流式逐字输出 |
| System Prompt | 无 | 数千字精心设计 |
| 上下文管理 | 无限增长 | token 计数 + 压缩 |
| 权限确认 | 无 | 工具执行前确认 |

**但核心骨架完全一致**：`messages` 数组 + `while` 循环 + `client.messages.create()`。Claude Code 的 `query()` 函数本质就是这个循环的增强版。

## 下一章预告

现在模型只能"说话"，不能"做事"。下一章加入 `read_file` 和 `write_file` 两个工具，让模型能读写文件——从聊天机器人变成 Agent。关键概念是 **tool_use 协议** 和 **内层 agentic loop**。