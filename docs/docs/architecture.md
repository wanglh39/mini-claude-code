# 架构原理拆解

> 本章不写代码。目标是建立心智模型——理解 Claude Code 的本质架构，后续章节都是在这个骨架上加肉。

---

## 1. Claude Code 是什么

Claude Code 是 Anthropic 推出的命令行 AI 编程助手。但它**不是**一个简单的"命令行套壳 API"。

它的本质是一个 **Agent Loop（智能体循环）**——一个让 LLM 自主决定"下一步做什么"的循环架构。

### 聊天机器人 vs Agent

| | 聊天机器人 | Agent |
|---|---|---|
| 流程 | 用户问 → AI 答 → 等用户 | 用户给目标 → AI 自主规划+执行 → 完成目标 |
| 能力 | 只能说话 | 能说话 + 能做事（读写文件、执行命令） |
| 循环 | 单轮 | 多轮自主（AI 决定何时结束） |
| 核心机制 | messages 数组 | messages 数组 + **工具调用循环** |

Claude Code 是 Agent，不是聊天机器人。区别就在于那个**工具调用循环**。

---

## 2. Agent Loop：整个项目的灵魂

用伪代码表示，Claude Code 的核心就是这段循环：

```
function agentLoop():
    messages = []
    
    while True:                          # 外层：用户交互
        user_input = 等待用户输入()
        messages.append({role: "user", content: user_input})
        
        while True:                      # 内层：工具调用
            response = 调用LLM(messages, tools)
            messages.append({role: "assistant", content: response})
            
            if response.包含工具调用:
                for 每个工具调用:
                    result = 执行工具(工具调用)
                    messages.append({role: "user", content: tool_result(result)})
                # 不 break，继续内层循环
                # 模型会看到工具结果，决定下一步
            else:
                # 模型说完了（stop_reason = "end_turn"）
                显示(response.text)
                break                    # 回到外层，等用户
```

### 两层循环的职责

```
┌─────────────────────────────────────────────────┐
│  外层循环（用户交互）                             │
│                                                   │
│  while True:                                      │
│    user_input = 等待用户()                        │
│    messages.push(user_input)                      │
│                                                   │
│    ┌─────────────────────────────────────┐       │
│    │  内层循环（工具调用）                  │       │
│    │                                       │       │
│    │  while True:                          │       │
│    │    resp = LLM(messages, tools)        │       │
│    │    messages.push(resp)                │       │
│    │    if resp.has_tool_calls:            │       │
│    │      results = 执行工具(resp)         │       │
│    │      messages.push(results)           │       │
│    │      continue  ← 继续内层             │       │
│    │    else:                              │       │
│    │      显示(resp.text)                  │       │
│    │      break  ← 回外层                  │       │
│    └─────────────────────────────────────┘       │
│                                                   │
└─────────────────────────────────────────────────┘
```

- **外层**：等待用户输入，一轮一轮地交互
- **内层**：模型可能连续调用多个工具（读文件→分析→写文件→执行命令），直到认为任务完成才退出内层

**关键洞察**：内层循环是 Agent 的本质。模型不是"被调一次就完"，而是"调一次→看结果→再决定→再调..."，这个循环让模型有了"自主性"。

---

## 3. tool_use 协议

模型怎么"做事"？通过 **tool_use 协议**。

### 三个步骤

```
① 请求侧：你告诉模型有哪些工具可用

    tools = [
      {
        name: "read_file",
        description: "读取文件内容",
        input_schema: { type: "object", properties: { path: ... } }
      }
    ]
    
    response = client.messages.create({ model, messages, tools })
                                          ^^^^^^^^^^^^^^^^^^^^
                                          把工具定义传进去

② 响应侧：模型返回工具调用请求

    response.content = [
      { type: "text", text: "我来读取这个文件" },
      { type: "tool_use",           ← 模型请求调用工具
        id: "toolu_xxx",
        name: "read_file",
        input: { path: "/src/main.ts" } }
    ]
    response.stop_reason = "tool_use"  ← 表示模型想调工具

③ 回传侧：你执行工具，把结果回传

    result = fs.readFileSync("/src/main.ts")  ← 你执行
    
    messages.push({
      role: "user",
      content: [{
        type: "tool_result",
        tool_use_id: "toolu_xxx",    ← 关联到哪个工具调用
        content: "文件内容..."        ← 执行结果
      }]
    })
    
    # 然后继续循环，模型会看到工具结果
```

### 一次完整的工具调用流程

```
用户: "帮我看看 main.ts 有多少行"

messages.push({role: "user", content: "帮我看看 main.ts 有多少行"})

→ LLM 调用 (带 tools)
← response: stop_reason="tool_use", content=[tool_use: read_file({path:"main.ts"})]

→ 执行工具: fs.readFileSync("main.ts")
→ messages.push({role:"user", content:[tool_result: "文件内容..."]})

→ LLM 调用 (模型现在看到了文件内容)
← response: stop_reason="end_turn", content=[text: "main.ts 有 42 行"]

→ 输出给用户: "main.ts 有 42 行"
→ break 内层循环，等用户下一轮
```

### stop_reason 的含义

| stop_reason | 含义 | 动作 |
|-------------|------|------|
| `"tool_use"` | 模型想调工具 | 执行工具，结果加入 messages，**继续内层循环** |
| `"end_turn"` | 模型说完了 | 输出文本，**break 内层循环** |
| `"max_tokens"` | 达到长度限制 | 截断输出，break |
| `"stop_sequence"` | 遇到停止词 | break |

---

## 4. 事件流模型（Streaming）

非流式调用是一次性返回完整结果。流式调用是**逐 token 推送**，体验更好。

### 事件类型

```
message_start          ← 消息开始（含 usage 初始值）
│
├── content_block_start (index=0, type="text")
│   ├── content_block_delta (text_delta: "我")
│   ├── content_block_delta (text_delta: "来")
│   ├── content_block_delta (text_delta: "读")
│   └── content_block_stop (index=0)
│
├── content_block_start (index=1, type="tool_use")
│   ├── content_block_delta (input_json_delta: '{"path"')
│   ├── content_block_delta (input_json_delta: ': "main')
│   ├── content_block_delta (input_json_delta: '.ts"}')
│   └── content_block_stop (index=1)
│
├── message_delta (stop_reason="tool_use")
└── message_stop
```

### 两种 delta 类型

- **`text_delta`**：文本增量，直接输出到终端
- **`input_json_delta`**：工具参数 JSON 的增量，需要拼接成完整 JSON 再解析

流式的难点在于：工具参数不是一次性给的，而是**碎片化推送**的。你需要把 `input_json_delta` 拼接起来，等 `content_block_stop` 后才能 `JSON.parse()` 得到完整参数。

---

## 5. System Prompt 的角色

System Prompt 不是"提示词"，是**规则注入**。

```
System Prompt = 
  身份定义        ("你是代码助手")
  + 工具使用规则   ("优先用 grep 搜索代码")
  + 代码风格约束   ("不添加多余注释")
  + 安全约束       ("不执行破坏性命令")
  + 环境信息       ("工作目录: /project, Git分支: main")
```

### 为什么需要 System Prompt

没有 system prompt，模型的行为是"随机"的——它可能用 `read_file` 读整个目录，可能写一堆注释，可能执行 `rm -rf`。

System Prompt 的作用是**约束模型行为到合理范围**。它不是魔法，而是利用了模型对指令的遵循能力。

### 动态注入

环境信息是动态的：

```typescript
function buildSystemPrompt() {
  return `
你是代码助手。
工作目录: ${process.cwd()}
操作系统: ${process.platform}
Git分支: ${execSync("git rev-parse --abbrev-ref HEAD")}
日期: ${new Date().toISOString()}
  `;
}
```

这让模型知道"我在哪"、"项目什么状态"，从而做出更合理的决策。

---

## 6. 上下文窗口

### 问题

LLM 有**上下文窗口限制**（Claude: 200K tokens，DeepSeek: 64K-128K）。`messages` 数组太长就会超限，API 报错。

### 上下文增长来源

```
messages 数组增长来源:
  1. 用户输入         — 每轮几十到几百 token
  2. 模型回复         — 几百到几千 token
  3. 工具调用请求      — 较小
  4. 工具执行结果      — 可能非常大！（读一个文件几千行）
```

**工具结果是上下文膨胀的主要来源。** 一次 `read_file` 读大文件，可能就占了几万 token。

### 策略

| 策略 | 做法 | 适用场景 |
|------|------|----------|
| 截断旧消息 | 保留 system + 最近 N 轮 | 临时性对话 |
| 压缩历史 | 用模型总结旧对话，替换 | 长期任务 |
| 工具结果截断 | 大输出只保留头尾 | 工具返回大文件 |

---

## 7. 权限模型

Agent 能执行命令、写文件——这很**危险**。如果模型执行了 `rm -rf /` 怎么办？

### 权限层级

```
工具执行前:
  ┌─ 安全工具（read, glob, grep）──→ 自动批准
  │
  ├─ 危险工具（write, edit, bash）─→ 需要确认
  │   └─ 显示操作内容，用户 y/n
  │
  └─ --auto-approve 模式 ─────────→ 全部自动批准（危险但方便）
```

### 工作目录边界

除了确认机制，还有路径边界：拒绝访问工作目录之外的文件，防止模型修改系统文件。

---

## 8. 子智能体

### 概念

子智能体是 **Agent 里的 Agent**。父 Agent 通过 `Task` 工具 spawn 一个子 Agent：

```
父 Agent: "帮我找一下项目里所有处理错误的代码"
  → 调用 Task 工具
    → spawn 子 Agent（独立 messages 数组）
      → 子 Agent 自主搜索（grep, read_file, ...）
      → 子 Agent 完成搜索，返回结果
  ← 父 Agent 收到结果，继续工作
```

### 为什么要子智能体

1. **上下文隔离**：子任务不污染父 Agent 的上下文
2. **工具限制**：给子 Agent 限制工具集（如只给搜索工具，不给写工具）
3. **并行**：多个子 Agent 同时工作（Claude Code 支持最多 10 个并行）

---

## 9. 完整架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Mini Claude Code                         │
│                                                               │
│  ┌─────────────┐    ┌──────────────────────────────────┐    │
│  │  CLI 入口    │───→│         Agent Loop               │    │
│  │  (readline)  │    │                                   │    │
│  └─────────────┘    │  while True:                      │    │
│                      │    user_input = 等待用户()         │    │
│  ┌─────────────┐    │    messages.push(user_input)      │    │
│  │  Config     │───→│                                   │    │
│  │  (.env)     │    │    while True:  # 内层循环        │    │
│  └─────────────┘    │      resp = LLM(messages, tools)  │    │
│                      │      if resp.has_tool_calls:     │    │
│  ┌─────────────┐    │        result = 执行工具()  ←─────┼──┐ │
│  │  System     │───→│        messages.push(result)      │  │ │
│  │  Prompt     │    │      else:                        │  │ │
│  └─────────────┘    │        输出(resp.text)            │  │ │
│                      │        break                      │  │ │
│  ┌─────────────┐    │                                   │  │ │
│  │  Context    │───→│  ┌─────────────────────────────┐ │  │ │
│  │  Manager    │    │  │  Token 计数 / 压缩 / 截断    │ │  │ │
│  └─────────────┘    │  └─────────────────────────────┘ │  │ │
│                      └──────────────────────────────────┘  │ │
│                                                           │ │ │
│  ┌─────────────────────────────────────────────────────┐ │ │ │
│  │                    工具系统                          │ │ │ │
│  │                                                     │ │ │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │ │ │ │
│  │  │ read    │ │ write   │ │ edit    │ │ bash    │  │ │ │ │
│  │  │ _file   │ │ _file   │ │ _file   │ │         │  │ │ │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │ │ │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐               │ │ │ │
│  │  │ glob    │ │ grep    │ │ task    │               │ │ │ │
│  │  └─────────┘ └─────────┘ └─────────┘               │ │ │ │
│  │                                                     │ │ │ │
│  │  ┌─────────────────────────────────────────────┐   │ │ │ │
│  │  │           Permission Gate                    │   │ │ │ │
│  │  │  安全工具 → 自动 | 危险工具 → 确认           │   │ │ │ │
│  │  └─────────────────────────────────────────────┘   │ │ │ │
│  └─────────────────────────────────────────────────────┘ │ │ │
│                                                           │ │ │
│  ┌─────────────────────────────────────────────────────┐ │ │ │
│  │              LLM API (Anthropic SDK)                 │ │ │ │
│  │                                                       │ │ │ │
│  │  client.messages.create / .stream                    │ │ │ │
│  │  baseURL → Anthropic 官方 | DeepSeek 兼容           │ │ │ │
│  └─────────────────────────────────────────────────────┘ │ │ │
│                                                           │ │ │
│  ┌─────────────────────────────────────────────────────┐ │ │ │
│  │              Subagent (Task 工具)                    │ │ │ │
│  │  独立 messages | 独立工具集 | 独立循环              │ │ │ │
│  └─────────────────────────────────────────────────────┘ │ │ │
└───────────────────────────────────────────────────────────┘─┘─┘
                                                              │
                                                              ↓
                                                         执行工具
```

---

## 10. 本项目的学习路径

| 章 | 在架构中的位置 | 核心问题 |
|----|---------------|----------|
| Ch1 | Agent Loop 外层 | LLM 怎么调？多轮对话怎么维持？ |
| Ch2 | Agent Loop 内层 | 模型怎么调工具？工具结果怎么回传？ |
| Ch3 | 工具系统 | 每个工具怎么实现？ |
| Ch4 | LLM API 流式 | 逐 token 输出怎么处理？ |
| Ch5 | System Prompt | 怎么约束模型行为？ |
| Ch6 | Context Manager | 上下文太长怎么办？ |
| Ch7 | Permission Gate | 怎么防止模型干坏事？ |
| Ch8 | Subagent | 怎么 spawn 子 Agent？ |
| Ch9 | 全部整合 | 怎么打包成完整 CLI？ |

每章都是在上面架构图中填充一个模块。到 Ch9 时，架构图的所有部分都有实现。

---

## 11. 关键设计哲学

### 11.1 "模型决策，代码执行"

Agent 的核心分工：
- **模型**：决定"做什么"（调用哪个工具、传什么参数）
- **代码**：执行"怎么做"（实际读写文件、执行命令）

模型不执行代码，只**请求**执行。你的代码是执行者，模型是决策者。

### 11.2 "messages 数组是唯一真相"

整个 Agent 的状态就是一个 `messages` 数组。所有操作（用户输入、模型回复、工具调用、工具结果）都往这个数组里追加。理解了这一点，就理解了 Agent 的本质。

### 11.3 "循环即自主"

`while (true)` 循环让模型有了"自主性"——它不是被调一次就完，而是持续决策直到任务完成。这个循环的退出条件由**模型自己决定**（`stop_reason: "end_turn"`），这就是"自主"的含义。

### 11.4 "工具是模型的手脚"

没有工具的模型只能说话。有了工具，模型能读写文件、执行命令、搜索代码——工具把模型从"嘴"变成了"手"。工具系统的设计直接决定了 Agent 的能力边界。

---

## 12. 前置知识

阅读本系列前，建议了解：

- **TypeScript 基础**：async/await、类型、模块
- **Node.js 基础**：fs 模块、child_process、readline
- **REST API 概念**：请求/响应、JSON
- **命令行基础**：能使用 terminal

不需要了解 LLM 内部原理（transformer 等），只需要知道"给 API 发 messages，返回文本"即可。