# 架构原理拆解（Ch0）

> 本章不写代码。目标是建立完整的心智模型——理解 Claude Code 的本质架构，后续章节都是在这个骨架上加肉。
>
> **如果你只读一章，就读这章。** 后面所有章节都是在填充本章描述的架构图。
>
> 本章面向初学者。你会看到很多"为什么"的追问，因为理解一个系统本质上是理解它每一个设计决策背后的理由。代码只是这些理由落地后的产物。

---

## 目录

- [0. 前置知识：你需要知道什么](#0-前置知识你需要知道什么)
- [1. Claude Code 到底是什么](#1-claude-code-到底是什么)
- [2. Agent Loop：整个项目的灵魂](#2-agent-loop整个项目的灵魂)
- [3. tool_use 协议：模型如何驱动工具](#3-tool_use-协议模型如何驱动工具)
- [4. 流式事件模型：响应是如何"长"出来的](#4-流式事件模型响应是如何长出来的)
- [5. System Prompt：不是提示词，而是规则注入](#5-system-prompt不是提示词而是规则注入)
- [6. 上下文窗口：唯一的"记忆"及其管理](#6-上下文窗口唯一的记忆及其管理)
- [7. 权限模型：安全阀的设计](#7-权限模型安全阀的设计)
- [8. 子智能体：分形即架构](#8-子智能体分形即架构)
- [9. 完整架构图](#9-完整架构图)
- [10. 关键设计哲学](#10-关键设计哲学)
- [11. 常见误解](#11-常见误解)
- [12. 前置知识检查清单](#12-前置知识检查清单)
- [13. 扩展思考题](#13-扩展思考题)

---

## 0. 前置知识：你需要知道什么

在深入之前，先确认你对以下概念有基本了解。不需要精通，但需要知道"是什么"以及"在我们这个项目里扮演什么角色"。本节会刻意讲得啰嗦，因为后续章节不会再回头解释这些砖块。

### 0.1 什么是 LLM（大语言模型）

LLM（Large Language Model）是一个函数：**给一段文本，返回一段文本**。

```
输入: "你好"
输出: "你好！有什么可以帮你的？"
```

就这么简单。所有花哨的"AI 能力"，本质都是这个函数的不同调用方式。

它有三个核心特征，每一个都会深刻影响 Claude Code 的架构：

**特征一：无状态（stateless）。** 每次调用，服务端不记得上一次说了什么。你给什么输入，它就给什么输出，仅此而已。服务器不会为你保留任何会话信息。

> **关键理解**：LLM 不是一个"有记忆的对话伙伴"，它只是一个"文本转换函数"。所谓的"多轮对话"，是我们（开发者）在代码里维护一个历史消息数组，每次调用都把完整历史传进去。记忆是**我们伪造**出来的。

这直接决定了 Claude Code 的核心数据结构：一个 `messages` 数组。这个数组是唯一的"记忆"，每次调用 LLM 都要把它完整传过去。后面会反复回到这一点。

**特征二：概率性（probabilistic）。** 同样的输入，可能得到不同的输出。模型是在"采样"，不是在"计算"。这意味着：

- 你问它"1+1等于几"，它大概率说"2"，但理论上可能说"3"。
- 你让它调同一个工具，它可能这次用参数 A，下次用参数 B。

Claude Code 的所有"鲁棒性设计"（重试、校验、错误反馈给模型让它自己改）本质上都是在应对这个特征。

**特征三：能力边界由训练数据决定。** 模型"知道"什么、"会"什么，是训练阶段就定死的。它不能在运行时"学会"新东西。所以：

- 模型不知道你本机的文件长什么样，必须由代码"告诉"它（通过工具返回结果）。
- 模型不知道现在几点，必须由代码在 system prompt 里告诉它。
- 模型不知道你的项目用 React 还是 Vue，必须由代码或它自己用工具去探查。

这就是为什么 Agent 需要"工具"——工具是补足模型运行时信息缺失的唯一手段。

### 0.2 什么是 API

API（Application Programming Interface）是程序之间通信的接口。Anthropic 提供了一个 HTTP API：

```
你的代码 → HTTP 请求（包含 messages）→ Anthropic 服务器 → HTTP 响应（包含回复）→ 你的代码
```

展开一点，这个 HTTP 请求大概长这样：

```http
POST /v1/messages HTTP/1.1
Host: api.anthropic.com
x-api-key: sk-ant-...
content-type: application/json

{
  "model": "claude-sonnet-4-20250514",
  "messages": [{"role": "user", "content": "你好"}],
  "max_tokens": 1024
}
```

而响应大概长这样：

```http
HTTP/1.1 200 OK
content-type: application/json

{
  "id": "msg_xxx",
  "stop_reason": "end_turn",
  "content": [{"type": "text", "text": "你好！有什么可以帮你的？"}]
}
```

`@anthropic-ai/sdk` 是对这个 HTTP API 的封装，让你不用手写 HTTP 请求，直接用 JavaScript 函数调用：

```typescript
const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  messages: [{ role: "user", content: "你好" }],
});
// response.content 里就是模型的回复
```

**为什么要理解底层 HTTP？** 因为 SDK 只是糖。当流式响应出问题、当 tool_use 协议搞不懂、当 `stop_reason` 行为反常时，你都得回到"它本质是一个 HTTP 请求/响应"这个层面去理解。SDK 帮你省了手写 JSON 的麻烦，但没帮你省理解协议的必要。

### 0.3 什么是 Agent

Agent（智能体）= **LLM + 工具 + 循环**

- **LLM**：负责"思考"——决定下一步做什么
- **工具**：负责"执行"——读写文件、运行命令等
- **循环**：负责"持续"——不是调一次就完，而是持续决策直到任务完成

```
普通聊天机器人: 用户问 → LLM 答 → 等用户
Agent:          用户给目标 → LLM 决策 → 工具执行 → LLM 看结果 → 再决策 → ... → 完成
```

**Agent 和聊天机器人的本质区别**：Agent 有**自主性**——它能自己决定调什么工具、什么时候完成任务，而不是每轮都需要用户输入。

这个"自主性"是 Agent 架构的全部魔力所在，也是全部风险所在：

- 魔力：你可以说"帮我修这个 bug"，然后去喝咖啡，Agent 自己读文件、找问题、改代码、跑测试。
- 风险：Agent 可能误删文件、跑错命令、陷入死循环。所以需要权限模型（第 7 节）。

理解 Agent 的一个有用类比：**LLM 是大脑，工具是手脚，循环是心跳。** 大脑决定动手，手脚执行，心跳让这个过程持续运转。没有循环，Agent 就退化成"调一次 API 就结束"的普通程序。

### 0.4 什么是 TypeScript / Node.js

- **TypeScript** = JavaScript + 类型。运行前会检查类型是否正确，减少运行时错误。
- **Node.js** = 让 JavaScript 能在服务器/命令行运行的运行时（不在浏览器里）。

本项目用 TypeScript 写代码，用 Node.js 运行。`tsx` 工具让我们免编译直接运行 `.ts` 文件。

为什么用 TypeScript 而不是纯 JavaScript？因为 Agent 代码会频繁处理**结构化数据**（messages 数组、tool_use 对象、tool_result 对象），这些结构的形状一旦搞错，调试会非常痛苦。类型系统让这种错误在写代码时就暴露，而不是在 Agent 跑到一半时崩掉。

举个具体例子，一条 message 的类型大致是：

```typescript
type Message = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
};

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: any }
  | { type: "tool_result"; tool_use_id: string; content: string };
```

看到没？`content` 既可以是字符串又可以是数组，数组里又有三种不同的块。如果没有类型，你很容易写出 `message.content.text` 然后在运行时发现 `content` 是字符串而崩溃。类型系统在写代码时就告诉你"这里可能是字符串，先 narrow 一下"。

### 0.5 什么是 readline

`readline` 是 Node.js 内置模块，用于在命令行读取用户输入：

```typescript
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("你叫什么？", (answer) => {
  console.log(`你好，${answer}`);
});
```

它是我们实现 CLI（命令行界面）交互的基础。

为什么需要专门提它？因为 Claude Code 是一个**命令行程序**，不是网页、不是 IDE 插件（虽然它也能作为 IDE 插件运行，但内核是 CLI）。命令行程序要和用户交互，就得读用户在终端敲的字符。`readline` 就是干这个的。

更准确地说，Claude Code 用的是 `readline` 的进阶版——支持多行输入、历史记录、自动补全。但本质都是同一个东西：从 stdin 读字符，解析成一行一行的输入。

### 0.6 什么是 async/await（异步编程）

Node.js 是单线程的，但要做很多"等"的事情：等网络响应、等文件读写、等用户输入。如果都用同步阻塞，整个程序就卡死了。

`async/await` 是 JavaScript 处理"等"的语法糖：

```typescript
// 不用 await：代码会继续往下走，不等结果
const promise = fetch("https://api.anthropic.com/...");
console.log("这行会立刻执行，不管 fetch 完没完");

// 用 await：代码会在这里暂停，等结果回来再继续
const response = await fetch("https://api.anthropic.com/...");
console.log("这行会等 fetch 完成才执行");
```

在 Agent 里，几乎每一步都是异步的：调 LLM 是异步、执行工具是异步、读用户输入是异步。所以你会看到代码里到处都是 `await`。这不是风格选择，是本质需要。

### 0.7 什么是 JSON Schema

JSON Schema 是描述"一个 JSON 应该长什么样"的格式。比如"这个对象必须有 `path` 字段，类型是字符串"。

```json
{
  "type": "object",
  "properties": {
    "path": { "type": "string" }
  },
  "required": ["path"]
}
```

Claude Code 用 JSON Schema 来定义工具的参数。模型看到 schema，就知道"调这个工具要传什么参数"。这是 tool_use 协议的基础，第 3 节会详细讲。

---

## 1. Claude Code 到底是什么

### 1.1 表面看

Claude Code 是 Anthropic 推出的命令行 AI 编程助手。你在终端里跟它说话，它能：

- 读写你的代码文件
- 执行 shell 命令（如 `npm test`、`git status`）
- 搜索代码库
- 自主完成多步骤任务（如"帮我修这个 bug"）

### 1.2 本质看

Claude Code 是一个 **Agent Loop（智能体循环）**——一个让 LLM 自主决定"下一步做什么"的循环架构。

它**不是**：
- ❌ 一个"套壳 API"（只是转发请求和响应）
- ❌ 一个"聊天机器人"（只能说话不能做事）
- ❌ 一个"代码生成器"（只生成代码不执行）

它**是**：
- ✅ 一个自主决策循环（LLM 决定做什么 → 代码执行 → LLM 看结果 → 再决策）
- ✅ 一个工具编排系统（把文件操作、命令执行等工具组织起来给 LLM 用）
- ✅ 一个上下文管理器（维护对话历史，处理 token 限制）

### 1.3 为什么理解 Claude Code 有价值

Claude Code 的架构是**所有 AI Agent 产品的通用骨架**：

- ChatGPT 的 Code Interpreter → Agent Loop + 工具
- Cursor 的 Agent 模式 → Agent Loop + 工具
- Devin → Agent Loop + 工具
- 任何"AI 自主完成任务"的产品 → Agent Loop + 工具

理解了 Claude Code 的 2000 行核心，就理解了所有 Agent 产品的底层原理。差异只在工具种类和工程打磨，不在架构。

这就像理解了 TCP/IP 就理解了整个互联网的通信骨架——具体实现千差万别（Linux 协议栈、Windows 协议栈、BSD 协议栈），但核心思想是一套。Agent Loop 就是 AI Agent 世界的"TCP/IP"。

---

## 2. Agent Loop：整个项目的灵魂

### 2.1 用伪代码表示

Claude Code 的核心就是这段循环：

```python
function agentLoop():
    messages = []                          # 唯一的状态：消息历史
    
    while True:                            # 外层循环：用户交互
        user_input = 等待用户输入()
        messages.append({role: "user", content: user_input})
        
        while True:                        # 内层循环：工具调用
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
                break                      # 回到外层，等用户
```

**就这么多。** 所有复杂功能都是在这个骨架上加肉。

### 2.2 两层循环的职责

```
┌─────────────────────────────────────────────────────────┐
│  外层循环（用户交互）                                     │
│                                                           │
│  职责：等待用户输入，一轮一轮地交互                        │
│  退出：用户输入 "exit"                                    │
│                                                           │
│  while True:                                              │
│    user_input = 等待用户()                                │
│    messages.push(user_input)                              │
│                                                           │
│    ┌─────────────────────────────────────────────┐       │
│    │  内层循环（工具调用）                          │       │
│    │                                               │       │
│    │  职责：让模型自主完成任务                      │       │
│    │  退出：模型不再请求工具（stop_reason=end_turn）│       │
│    │                                               │       │
│    │  while True:                                  │       │
│    │    resp = LLM(messages, tools)                │       │
│    │    messages.push(resp)                        │       │
│    │    if resp.has_tool_calls:                    │       │
│    │      results = 执行工具(resp)                 │       │
│    │      messages.push(results)                   │       │
│    │      continue  ← 继续内层                     │       │
│    │    else:                                      │       │
│    │      显示(resp.text)                          │       │
│    │      break  ← 回外层                          │       │
│    └─────────────────────────────────────────────┘       │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 2.3 为什么需要两层循环

这是初学者最容易困惑的点，值得展开讲。

**外层循环**的存在是因为：用户可能连续给多个任务。完成一个任务后，等用户给下一个。

```python
# 外层循环的一个"回合"
用户: "帮我修 main.ts 里的 bug"
[内层循环跑完，bug 修好了]
用户: "再帮我加个测试"
[内层循环跑完，测试加好了]
用户: "exit"
```

如果只有内层循环，程序修完一个 bug 就退出了，没法连续交互。

**内层循环**的存在是因为：一个用户任务可能需要多个工具调用。比如用户说"帮我修这个 bug"：

```
用户: "帮我修 main.ts 里的 bug"

内层循环:
  第1轮: LLM → 调用 read_file("main.ts") → 看到代码
  第2轮: LLM → 调用 grep("error") → 找到错误位置
  第3轮: LLM → 调用 edit_file(...) → 修改代码
  第4轮: LLM → 调用 run_command("npm test") → 测试通过
  第5轮: LLM → 不调工具，直接回复"修好了" → break
```

如果只有外层循环（每次用户输入只调一次 LLM），模型就只能"说一句话"而不能"做事"。它没有机会看到工具结果再决策。

**两层循环的分工本质**：

| 维度 | 外层循环 | 内层循环 |
|------|---------|---------|
| 驱动者 | 用户 | 模型 |
| 退出条件 | 用户主动退出 | 模型不再调工具 |
| 每轮做什么 | 读用户输入 | 调 LLM + 执行工具 |
| 谁决定轮数 | 用户（想聊多久聊多久） | 模型（任务完成就停） |
| 状态变化 | messages 增长 | messages 增长 |

注意一个深刻的不对称：**外层循环由用户驱动，内层循环由模型驱动**。这正是"自主性"的体现——内层循环里，代码不决定下一步做什么，是模型决定。代码只是忠实执行模型的决策。这个"控制权反转"是 Agent 和普通程序的根本区别。

### 2.4 内层循环是 Agent 的本质

如果只能记住一件事，记这件：**内层循环就是 Agent 的定义本身**。

去掉外层循环，Agent 还能完成单个任务（只是做完就退出）。
去掉内层循环，Agent 就不再是 Agent——它退化成"调一次 API 显示结果"的聊天机器人。

内层循环的每一轮叫做一个 **turn**（轮次）。一个 turn 包含：

1. 把 `messages` 发给 LLM
2. LLM 返回 response（可能包含 tool_use）
3. 把 response 追加到 `messages`
4. 如果有 tool_use，执行工具，把 tool_result 追加到 `messages`
5. 进入下一个 turn

一个用户任务可能跑 1 个 turn（模型直接回答），也可能跑 20 个 turn（模型反复调工具）。**轮数由模型自己决定**，这是自主性的来源。

### 2.5 内层循环的终止条件

内层循环什么时候 break？当模型**不再请求工具**时。具体来说，API 响应里有个 `stop_reason` 字段：

- `stop_reason: "end_turn"` —— 模型说"我说完了"。这是最正常的结束。
- `stop_reason: "tool_use"` —— 模型说"我要调工具"。不 break，继续循环。
- `stop_reason: "max_tokens"` —— 模型说"我话被截断了"。需要处理。
- `stop_reason: "stop_sequence"` —— 模型碰到了你指定的停止序列。本项目用不到。

所以内层循环的精确终止条件是：`stop_reason !== "tool_use"`。只要模型还想调工具，就继续；不想调了，就回外层。

这里有个初学者常困惑的问题：**为什么模型说"我要调工具"时，`stop_reason` 是 `"tool_use"` 而不是 `"end_turn"`？** 因为从模型的角度看，它这一轮的"发言"还没结束——它要等工具结果回来，才能继续说。调工具不是"结束这一轮"，而是"暂停这一轮等数据"。所以 `stop_reason` 反映的是"我为什么停止生成 token"，而不是"我为什么结束任务"。

### 2.6 一个完整的内层循环实例

用户说"读一下 package.json 然后告诉我用了什么框架"：

```python
# Turn 1
messages = [
  {role: "user", content: "读一下 package.json 然后告诉我用了什么框架"}
]
response = LLM(messages)
# response.content = [
#   {type: "text", text: "我来读一下"},
#   {type: "tool_use", id: "t1", name: "read_file", input: {path: "package.json"}}
# ]
# response.stop_reason = "tool_use"
messages.push(response)
result = read_file({path: "package.json"})
# result = '{"name": "my-app", "dependencies": {"react": "..."}}'
messages.push({role: "user", content: [{type: "tool_result", tool_use_id: "t1", content: result}]})
# stop_reason 是 tool_use，继续循环

# Turn 2
response = LLM(messages)
# response.content = [
#   {type: "text", text: "这个项目用的是 React 框架"}
# ]
# response.stop_reason = "end_turn"
messages.push(response)
显示("这个项目用的是 React 框架")
# stop_reason 不是 tool_use，break
```

注意 Turn 2 的 `messages` 里包含了 Turn 1 的所有内容（user 输入、assistant 的 tool_use、user 的 tool_result）。模型在 Turn 2 能看到工具返回的文件内容，所以能回答。这就是"把完整历史每次都传过去"的含义。

---

## 3. tool_use 协议：模型如何驱动工具

tool_use 是 Anthropic API 的一套协议，规定了"模型怎么告诉代码要调什么工具"和"代码怎么把结果告诉模型"。理解这套协议是理解 Agent 的关键。

### 3.1 三步骤

工具调用的完整流程是三步：

**步骤一：代码告诉模型"有哪些工具可用"。**

这是在调用 API 时传入的 `tools` 参数：

```typescript
const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  messages: messages,
  tools: [
    {
      name: "read_file",
      description: "读取文件内容",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "文件路径" }
        },
        required: ["path"]
      }
    },
    {
      name: "run_command",
      description: "执行 shell 命令",
      input_schema: {
        type: "object",
        properties: {
          command: { type: "string", description: "要执行的命令" }
        },
        required: ["command"]
      }
    }
  ]
});
```

每个工具定义包含三部分：
- `name`：工具名，模型用它来引用工具
- `description`：工具描述，模型靠它理解"这个工具是干什么的"
- `input_schema`：参数的 JSON Schema，模型靠它知道"调这个工具要传什么"

**`description` 极其重要。** 模型不会看你的代码实现，它只看 description 来决定用不用这个工具、怎么用。description 写得不清楚，模型就会用错或不用。写工具描述是 Agent 开发里最像"写 prompt"的部分。

**步骤二：模型告诉代码"我要调这个工具，参数是这些"。**

模型在响应里返回一个 `tool_use` 块：

```typescript
// response.content
[
  { type: "text", text: "我来读一下文件" },
  {
    type: "tool_use",
    id: "toolu_01abc",           // 唯一 ID，用于配对结果
    name: "read_file",            // 要调的工具
    input: { path: "main.ts" }    // 参数
  }
]
```

注意 `id` 字段。每次工具调用都有一个唯一 ID，因为模型可能一次调多个工具，代码要用 ID 把"哪个结果对应哪次调用"搞清楚。

**步骤三：代码执行工具，把结果告诉模型。**

代码拿到 `tool_use` 后，真正去执行工具（比如真的读文件），然后把结果包成 `tool_result` 块，作为新的 user 消息追加到 messages：

```typescript
messages.push({
  role: "user",
  content: [
    {
      type: "tool_result",
      tool_use_id: "toolu_01abc",   // 对应步骤二的 id
      content: "文件内容..."          // 工具返回的结果
    }
  ]
});
```

然后下一轮调 LLM，模型就能看到这个结果。

### 3.2 完整时序图

把三步骤串起来，一次工具调用的完整时序：

```
代码                        API/模型                      实际工具
 │                            │                            │
 │  ── messages + tools ──→  │                            │
 │                            │                            │
 │  ←── response ──────────  │                            │
 │      (含 tool_use)         │                            │
 │                            │                            │
 │  执行工具 ───────────────────────────────────────────→  │
 │  ←── 工具结果 ────────────────────────────────────────  │
 │                            │                            │
 │  messages.push(tool_result)│                            │
 │                            │                            │
 │  ── messages + tools ──→  │                            │
 │  (现在 messages 里有结果了) │                            │
 │                            │                            │
 │  ←── response ──────────  │                            │
 │      (看到结果后的回复)     │                            │
```

关键点：**模型从不直接调工具**。模型只是"说"它想调什么，真正执行工具的是你的代码。模型和工具之间永远隔着你的代码。这是安全性的基础——你可以在这层做权限检查、参数校验、结果过滤。

### 3.3 stop_reason 的含义

`stop_reason` 是 API 响应里的一个字段，告诉你"模型为什么停止生成"。它有几种值：

| stop_reason | 含义 | 内层循环动作 |
|-------------|------|------------|
| `"end_turn"` | 模型说完了，不需要工具 | break，回外层 |
| `"tool_use"` | 模型要调工具 | 执行工具，继续循环 |
| `"max_tokens"` | 达到 max_tokens 上限，被截断 | 需要处理（拼接或停止） |
| `"stop_sequence"` | 碰到了指定的停止序列 | 本项目用不到 |
| `"pause_turn"` | 模型主动暂停（长任务） | 高级特性，暂不展开 |

最常打交道的是前两个。内层循环的核心判断就是：

```typescript
if (response.stop_reason === "tool_use") {
  // 执行工具，继续循环
} else {
  // 结束内层循环
  break;
}
```

### 3.4 多工具调用

模型可以在**一次响应**里请求调用**多个工具**：

```typescript
// response.content
[
  { type: "text", text: "我来同时读这两个文件" },
  { type: "tool_use", id: "t1", name: "read_file", input: { path: "a.ts" } },
  { type: "tool_use", id: "t2", name: "read_file", input: { path: "b.ts" } }
]
```

这时代码要：

1. 遍历所有 `tool_use` 块
2. **并行**执行这些工具（它们之间没有依赖时）
3. 把所有结果打包成**一条** user 消息的 content 数组：

```typescript
messages.push({
  role: "user",
  content: [
    { type: "tool_result", tool_use_id: "t1", content: "a.ts 的内容" },
    { type: "tool_result", tool_use_id: "t2", content: "b.ts 的内容" }
  ]
});
```

注意：**多个 tool_result 放在同一条 user 消息里**，不是分多条消息。这是协议要求。如果分多条，API 会报错。

并行执行是个优化——如果模型一次要读 5 个文件，串行读就慢 5 倍。但要注意：有些工具之间有隐含依赖（比如先创建目录再写文件），这时并行可能出问题。简单做法是全串行，复杂做法是让模型自己决定（但模型通常不知道哪些能并行）。

### 3.5 tool_result 为什么是 user 角色

这是初学者最常困惑的点：**工具结果明明是"代码"产生的，为什么它的 role 是 `"user"` 而不是什么 `"tool"` 或 `"system"`？**

原因在于 API 的消息格式约定：`messages` 数组里的消息只能是 `user` 或 `assistant` 两种角色。没有 `tool` 角色。工具结果必须塞进这两种之一，而塞进 `user` 是合理的，因为：

**从模型的角度看，tool_result 和 user 输入本质相同——都是"外界给模型的信息"。** 用户输入是"人类给模型的信息"，工具结果是"程序给模型的信息"。对模型来说，它们都是"输入"。而 `assistant` 角色是"模型自己产生的输出"。所以工具结果放 `user` 是语义正确的。

更技术地说，API 的对话格式是"交替的 user/assistant"。模型产出（assistant）和外界输入（user）必须交替。工具结果显然是"外界输入"（在模型产出之后、下一次模型产出之前），所以必须是 user。

如果你硬把 tool_result 放成 assistant，API 会报错，因为格式要求交替。如果你发明一个 `tool` 角色，API 也不认（它只支持 user/assistant/system）。

所以 `role: "user"` 不是设计缺陷，是格式约束下的必然选择，而且语义上也说得通。

### 3.6 工具定义的细节

一个完整的工具定义：

```typescript
{
  name: "edit_file",
  description: "编辑文件。用 old_string 替换为 new_string。old_string 必须在文件中唯一存在。",
  input_schema: {
    type: "object",
    properties: {
      path: { 
        type: "string", 
        description: "要编辑的文件路径" 
      },
      old_string: { 
        type: "string", 
        description: "要被替换的文本" 
      },
      new_string: { 
        type: "string", 
        description: "替换后的文本" 
      }
    },
    required: ["path", "old_string", "new_string"]
  }
}
```

几个要点：

- `description` 不只是写给用户看的，**模型真的会读它**。写得好，模型就用得准；写得差，模型就乱用。
- `input_schema` 里每个属性也可以有 `description`。模型会读这些来理解"这个参数是什么意思"。
- `required` 列出必填参数。模型会保证传这些参数（大部分时候）。
- 没有 enum、没有 min/max？模型可能传乱七八糟的值。schema 越严格，模型越不会乱来。

写工具定义是 Agent 开发的核心技能。它本质是"用 JSON Schema 给模型写 API 文档"。

---

## 4. 流式事件模型：响应是如何"长"出来的

到目前为止我们假设 API 调用是"一次性返回完整响应"。但实际使用时，Claude Code 用的是**流式（streaming）**响应——服务器一边生成一边发，客户端一边收一边处理。

### 4.1 为什么要流式

两个原因：

**原因一：用户体验。** 模型生成一个长回复可能要 10 秒。如果非流式，用户盯着空白屏幕 10 秒才看到结果。流式的话，用户看到字一个一个冒出来，感知上"快多了"——虽然总时间一样，但心理感受完全不同。

**原因二：工具调用可以更早开始。** 如果模型回复是"我来读文件" + tool_use，流式可以在收到 tool_use 后立即开始执行工具，不用等模型把后面的 text 也生成完（虽然通常 tool_use 在 text 之后）。

### 4.2 流式 API 的调用方式

```typescript
const stream = await client.messages.stream({
  model: "claude-sonnet-4-20250514",
  messages: messages,
  tools: tools,
});

for await (const event of stream) {
  // 处理每一个事件
  console.log(event);
}
```

`stream` 是一个异步迭代器，每次 `await` 拿到一个**事件**。事件是响应的一个"碎片"。

### 4.3 事件类型

流式响应不是一次性给你一个完整的 response 对象，而是给你一连串事件。主要事件类型：

```
message_start        → 消息开始，包含 message 元信息
content_block_start  → 一个内容块开始（块可能是 text、tool_use 等）
content_block_delta  → 一个内容块的数据增量
content_block_stop   → 一个内容块结束
message_delta        → 消息级别的增量（包含 stop_reason）
message_stop         → 消息结束
```

一个完整的流式响应，事件序列大概长这样：

```
message_start
content_block_start  (index=0, type="text")
content_block_delta  (index=0, text="我")
content_block_delta  (index=0, text="来")
content_block_delta  (index=0, text="读")
content_block_delta  (index=0, text="文件")
content_block_stop   (index=0)
content_block_start  (index=1, type="tool_use", id="t1")
content_block_delta  (index=1, partial_json='{"path": "main')
content_block_delta  (index=1, partial_json='.ts"}')
content_block_stop   (index=1)
message_delta        (stop_reason="tool_use")
message_stop
```

### 4.4 两种 delta

`content_block_delta` 事件有两种不同的 delta 类型，对应两种不同的内容块：

**text_delta**：文本增量。拼接起来就是模型的文字回复。

```typescript
{ type: "text_delta", text: "我" }
{ type: "text_delta", text: "来" }
{ type: "text_delta", text: "读" }
// 拼接：我来读
```

**input_json_delta**：工具参数的 JSON 增量。工具的 `input` 是个 JSON 对象，但流式时它不是一次性给你完整 JSON，而是给你 JSON 字符串的碎片：

```typescript
{ type: "input_json_delta", partial_json: '{"path": "m' }
{ type: "input_json_delta", partial_json: 'ain.ts"}' }
// 拼接：{"path": "main.ts"}，再 JSON.parse 得到 { path: "main.ts" }
```

### 4.5 工具参数为什么也是流式

这是初学者常觉得奇怪的：**工具参数又不是给人看的，为什么要流式？**

原因有二：

**原因一：模型生成一切都是 token by token 的。** 模型内部没有"先生成完整 JSON 再发"的能力，它就是一个 token 一个 token 地生成。生成文本和生成 JSON 参数对模型来说没区别——都是生成 token 序列。所以 API 把这个生成过程暴露出来，就是流式的。

**原因二：参数可能很长。** 想象一个 `write_file` 工具，要写 500 行代码。那 `input.content` 就是一个 500 行的字符串。如果非流式，用户要等模型把这 500 行全生成完才看到任何东西。流式的话，可以边生成边显示"正在写入..."，甚至边生成边算 token 数防止超限。

实际处理时，代码要做的是：

```typescript
let toolInputJson = "";
for await (const event of stream) {
  if (event.type === "content_block_delta") {
    if (event.delta.type === "input_json_delta") {
      toolInputJson += event.delta.partial_json;
    }
  }
}
// 流结束后
const toolInput = JSON.parse(toolInputJson);
```

把所有 `partial_json` 拼起来，再 `JSON.parse`，得到完整的工具参数对象。

### 4.6 流式处理的复杂度

流式让代码复杂了不少。非流式你只需要：

```typescript
const response = await client.messages.create(...);
// response.content 就是完整内容
```

流式你要：

1. 维护一个"正在累积的 response"对象
2. 处理各种事件，更新这个对象
3. 处理 text delta（拼接到当前 text block）
4. 处理 input_json delta（拼接到当前 tool_use 的 input JSON 字符串）
5. 流结束后，把累积的 JSON 字符串 parse 成对象
6. 处理中途断流、错误等边界情况

所以教学项目里有个取舍：**先学非流式理解原理，再学流式理解实战**。核心逻辑（Agent Loop、tool_use 协议）两者完全一样，流式只是把"一次性拿响应"变成"一点点拿响应"。

---

## 5. System Prompt：不是提示词，而是规则注入

### 5.1 System Prompt 是什么

每次调 API，除了 `messages`，还可以传一个 `system` 参数：

```typescript
const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  system: "你是一个专业的编程助手。回答要简洁。",
  messages: messages,
});
```

`system` 就是 System Prompt。它和 `messages` 里的 user 消息有什么区别？

**区别一：位置不同。** System Prompt 在所有 messages 之前，是"对话开始前就定好的"。

**区别二：角色不同。** user 消息是"对话参与者说的话"，System Prompt 是"对话发生的背景规则"。模型会把 System Prompt 当成"世界设定"来遵循，而不是"某个人的发言"。

**区别三：约束力不同。** 模型对 System Prompt 的遵循度通常高于对 user 消息的遵循度。用户说"忽略之前的指令"，模型可能听；System Prompt 说"不要执行危险命令"，模型更可能坚持。

### 5.2 不是"提示词"，是"规则注入"

很多人把 System Prompt 理解成"给模型的提示语"，像"请帮我写代码"这种。这是低估了它。

在 Claude Code 里，System Prompt 是**规则注入**——它定义了 Agent 的"行为规范"。比如：

```
你是一个命令行编程助手。
- 你可以读写文件、执行命令
- 修改文件前要先读取确认
- 执行危险命令前要请求用户确认
- 不要假设文件内容，要用工具读取
- 当前工作目录是 /home/user/project
- 当前时间是 2024-01-15 10:30
- 操作系统是 Linux
```

这不是"提示"，这是"工作守则"。模型把它当成"我必须这样工作"的规则。

### 5.3 结构层次

Claude Code 的 System Prompt 是有结构的，大致分几层：

**第一层：身份定义。**
```
你是 Claude Code，Anthropic 的命令行 AI 编程助手。
```
告诉模型"你是谁"。这影响模型的"自我认知"——它知道自己是编程助手，不是通用聊天机器人。

**第二层：能力描述。**
```
你可以通过工具读写文件、执行命令、搜索代码。
你擅长理解代码库结构、修复 bug、重构代码、写测试。
```
告诉模型"你能做什么"。这影响模型对自身能力的认知，避免它说"我做不到"或试图做做不到的事。

**第三层：行为规则。**
```
- 修改文件前先读取确认内容
- 执行有副作用的命令前请求用户确认
- 优先使用精确的字符串替换而非整文件重写
- 不要在回复里重复展示已修改的代码
```
告诉模型"你应该怎么做"。这是最关键的层——它定义了 Agent 的"工作风格"。

**第四层：环境信息。**
```
- 工作目录: /home/user/project
- 操作系统: Linux
- 当前时间: 2024-01-15 10:30
- Git 分支: main
```
告诉模型"你在什么环境里工作"。模型没有运行时信息，这些必须由代码注入。

**第五层：工具使用提示。**
```
- 用 read_file 读文件，不要假设内容
- 用 run_command 执行命令，不要编造命令输出
- 用 edit_file 做精确修改，用 write_file 创建新文件
```
告诉模型"工具怎么用"。这层和工具的 description 有点重复，但放在 System Prompt 里强化。

### 5.4 动态注入

System Prompt 不是写死的字符串，而是**动态生成**的。每次调 LLM，代码会重新构造 system prompt：

```typescript
function buildSystemPrompt(): string {
  return [
    "你是 Claude Code...",
    `工作目录: ${process.cwd()}`,
    `操作系统: ${os.platform()}`,
    `当前时间: ${new Date().toISOString()}`,
    `Git 分支: ${getGitBranch()}`,
  ].join("\n");
}
```

为什么动态？因为环境会变：

- 用户可能 `cd` 到不同目录
- 时间在流逝
- Git 分支会切换
- 操作系统是固定的但代码要跨平台

如果 System Prompt 写死，模型就不知道当前环境，会做出错误假设（比如在 Windows 上跑 Linux 命令）。

### 5.5 约束力来源

为什么模型会遵循 System Prompt？这不是魔法，是训练的结果。

模型在训练阶段见过大量"system + user + assistant"的对话数据，其中 system 消息通常是"高优先级指令"。模型学到了"system 消息的约束力 > user 消息的约束力"。所以当你把规则放 system 里，模型会"更认真"地遵循。

但这不是绝对的。模型也可能被"越狱"（jailbreak）——用户用巧妙的话术绕过 system 约束。所以 System Prompt 是"软约束"，不是"硬约束"。真正硬的约束（比如"绝对不能执行 rm -rf"）要靠**权限模型**（第 7 节）在代码层强制，不能只靠 system prompt。

这就是一个重要原则：**System Prompt 是行为引导，权限模型是安全底线。** 两者配合，前者让模型"通常表现好"，后者保证"即使模型表现不好也不会出大事"。

---

## 6. 上下文窗口：唯一的"记忆"及其管理

### 6.1 token 概念

LLM 不直接处理文本，它处理 **token**。token 是文本的"碎片"，大致是"一个词"或"一个字的一部分"：

```
"hello"      → 1 token
"hello world" → 2 tokens
"你好"        → 2 tokens（中文通常每字 1-2 token）
"function add(a, b) { return a + b; }" → 大概 10 tokens
```

具体怎么分词是模型的事，你不需要关心细节。你需要关心的是：**API 按 token 计费，模型按 token 有限制。**

### 6.2 上下文窗口限制

每个模型有个**上下文窗口大小**，比如 200K tokens。这意味着：

```
输入的 messages 总 token 数 + 输出的 token 数 ≤ 200K
```

如果输入已经 199K tokens，模型最多只能输出 1K tokens 就被截断（`stop_reason: "max_tokens"`）。

**为什么这是个大问题？** 因为 `messages` 是唯一的记忆，它**只增不减**。每轮 Agent Loop 都会往 messages 里加东西（user 输入、assistant 回复、tool_use、tool_result）。跑个 20 轮，messages 可能就几万 token。跑个 100 轮，可能就爆了。

### 6.3 增长来源

messages 的 token 增长有几个来源，按"吃 token 的大头"排序：

1. **tool_result**：工具返回的内容。读一个 1000 行的文件，tool_result 就 1 万多 token。这是最大的消耗。
2. **assistant 回复**：模型的文字回复。通常不长，但累积起来也不少。
3. **user 输入**：用户说的话。通常最短。
4. **tool_use**：模型请求工具的参数。中等长度。
5. **system prompt**：固定开销，每轮都一样。

最吃 token 的是 **tool_result**。一个"读代码库找 bug"的任务，可能读 20 个文件，每个文件几千 token，轻松十几万 token 进去。

### 6.4 三种管理策略

面对上下文窗口限制，有三种策略：

**策略一：截断（truncation）。**

最简单粗暴——messages 太长时，删掉早期的消息。

```typescript
function truncateMessages(messages: Message[], maxTokens: number): Message[] {
  while (countTokens(messages) > maxTokens) {
    messages.splice(1, 2); // 删掉最早的一对 user/assistant
  }
  return messages;
}
```

优点：简单。缺点：模型"失忆"——忘了早期做过什么，可能重复犯错或重复工作。

注意不能随便删——删 user 必须同时删对应的 assistant，删 tool_use 必须同时删对应的 tool_result，否则消息格式错乱。这是截断的复杂度所在。

**策略二：压缩（compression）。**

用 LLM 把早期对话"总结"成一段摘要，替换原始消息。

```typescript
// 伪代码
const summary = await llm("总结这段对话的关键信息: " + JSON.stringify(earlyMessages));
messages = [{ role: "user", content: summary }, ...recentMessages];
```

优点：保留关键信息。缺点：多一次 LLM 调用，慢且费钱；总结可能丢重要细节。

**策略三：外挂记忆（external memory）。**

把信息存到外部（文件、数据库），只在 messages 里放"指针"或"摘要"，需要时再用工具读。

```
messages 里: "项目结构见 /tmp/project_summary.md"
需要时: 模型调 read_file("/tmp/project_summary.md") 取回完整信息
```

优点：理论上无限记忆。缺点：模型得"知道"去读，得"知道"读哪个文件——这本身需要智能。

Claude Code 实际用的是**策略一为主，策略二为辅**。当 messages 接近上限时，触发截断；截断前可能先做一次压缩保留关键信息。

### 6.5 一个实际的 token 预算分配

假设 200K 上下文窗口，一次 Agent 任务的 token 预算大概这样分配：

```
System Prompt:        ~5K tokens（固定）
工具定义:             ~3K tokens（固定）
当前 user 输入:       ~500 tokens
留给历史 + 输出:      ~191K tokens
```

这 191K 要塞下所有历史消息 + 模型当前回复。如果历史已经 180K，模型只有 11K 的"说话空间"——可能话没说完就被截断。所以代码要监控 token 用量，在接近上限时主动截断，而不是等 API 报错。

---

## 7. 权限模型：安全阀的设计

### 7.1 为什么需要权限模型

Agent 能执行工具，工具能改文件、跑命令。这意味着 Agent 能做**任何**代码能做的事——包括删库、改系统配置、执行恶意命令。

如果完全信任模型，模型一个幻觉就能毁掉你的项目：

```
模型: "我觉得这个目录是多余的，删掉吧"
→ 执行 rm -rf /home/user/project
→ 项目没了
```

这不是假设，是真实风险。模型会犯错、会被误导、会误解指令。所以需要一个**独立于模型的权限层**，在代码执行前检查"这个操作是否被允许"。

### 7.2 权限层级

Claude Code 的权限是分层的，从宽到严：

**层级一：自动允许。**

低风险操作直接放行，不问用户：

- `read_file` —— 读文件不改变任何东西
- `glob` —— 搜索文件名不改东西
- `grep` —— 搜索内容不改东西

这些是"只读"操作，没有副作用，自动允许。

**层级二：需要确认。**

有副作用但可逆的操作，每次问用户：

- `edit_file` —— 改文件（能撤销，但麻烦）
- `write_file` —— 写文件（能覆盖，危险）
- `run_command`（非危险命令）—— 跑命令

用户看到"模型想执行 X，允许吗？"，按 y/n。

**层级三：禁止。**

高风险操作直接拒绝，即使用户在场也不能执行：

- `rm -rf /` —— 删根目录
- `format C:` —— 格式化磁盘
- 任何匹配黑名单的命令

这是"硬底线"，模型和用户都不能越过（除非用户显式配置允许）。

### 7.3 权限检查的位置

权限检查在**工具执行之前**：

```typescript
async function executeTool(toolUse: ToolUse): Promise<ToolResult> {
  // 1. 权限检查
  const allowed = await checkPermission(toolUse);
  if (!allowed) {
    return {
      tool_use_id: toolUse.id,
      content: "权限被拒绝。用户不允许执行这个操作。",
      is_error: true
    };
  }
  
  // 2. 实际执行
  const result = await actualExecute(toolUse);
  return result;
}
```

注意：**权限拒绝不抛异常，而是返回一个 tool_result**。模型会看到"权限被拒绝"，然后可以调整策略——比如改用别的方法，或者向用户解释为什么需要这个操作。

### 7.4 拒绝后怎么办

模型收到"权限被拒绝"的 tool_result 后，有几种可能反应：

**反应一：换方法。**
```
模型想: rm -rf build/ 被拒了
模型改: 用 rimraf build/ 或者一个一个删
```

**反应二：问用户。**
```
模型想: 执行 npm install 被拒了
模型说: "我需要执行 npm install 来安装依赖，可以吗？"
用户: "可以"（重新触发，这次允许）
```

**反应三：放弃。**
```
模型想: 删文件被拒了
模型说: "好的，我不删了。换个思路..."
```

**反应四：固执地重试。**（这是要避免的）
```
模型想: rm -rf 被拒了
模型又想: rm -rf 被拒了
模型又想: rm -rf 被拒了
... 死循环
```

为了防止反应四，代码可以加个"连续拒绝 N 次就强制 break 内层循环"的保护。或者靠模型自己学聪明（通常几次拒绝后模型会放弃）。

### 7.5 权限是"安全阀"不是"刹车"

权限模型不是要让 Agent 寸步难行，而是要在"出大事"前拦住。好的权限设计：

- 只拦真正危险的操作，不拦无害的
- 拦的时候给模型清晰的反馈，让它知道"为什么被拒"和"可以怎么改"
- 允许用户配置"信任某些操作"，减少打扰

类比：权限是汽车的安全阀，不是刹车。安全阀在压力过大时才触发，平时不影响驾驶。刹车是用户主动减速用的——那是用户说"停下"的机制，和权限是两回事。

---

## 8. 子智能体：分形即架构

### 8.1 什么是子智能体

子智能体（subagent）就是**Agent 里的 Agent**。主 Agent 在执行任务时，可以"启动"一个子 Agent，把子任务交给它，子 Agent 跑完把结果返回给主 Agent。

```
主 Agent: "帮我重构这个模块"
  → 主 Agent 启动子 Agent: "分析这个模块的结构"
    → 子 Agent 跑自己的 Agent Loop，读文件、搜索、分析
    → 子 Agent 返回: "这个模块有 5 个文件，主要职责是 X"
  → 主 Agent 启动子 Agent: "重构文件 A"
    → 子 Agent 跑自己的 Agent Loop
    → 子 Agent 返回: "重构完成，改了 30 行"
  → 主 Agent: "重构完成"
```

### 8.2 为什么要子智能体

三个原因：

**原因一：上下文隔离。**

子 Agent 有自己独立的 `messages` 数组。它的工作不会污染主 Agent 的上下文。

想象主 Agent 要分析 20 个文件。如果自己干，20 个文件的 tool_result 全塞进主 Agent 的 messages，上下文爆了。如果派 5 个子 Agent 各分析 4 个，子 Agent 的上下文爆了不影响主 Agent，主 Agent 只收到 5 份摘要。

这是子 Agent 最核心的价值——**上下文分治**。

**原因二：专业化。**

不同子 Agent 可以有不同的工具、不同的 system prompt：

```
子 Agent A: 专门写测试，system prompt 强调测试规范
子 Agent B: 专门做 code review，system prompt 强调审查标准
子 Agent C: 专门查文档，只有搜索工具没有修改工具
```

主 Agent 根据任务类型派合适的子 Agent，比"一个 Agent 干所有事"更精准。

**原因三：并行。**

多个子 Agent 可以并行跑。主 Agent 派 3 个子 Agent 同时分析 3 个模块，总时间约等于最慢的那个，而不是三个加起来。

### 8.3 实现本质

子 Agent 的实现本质上是**递归**。子 Agent 就是一个完整的 Agent Loop，和主 Agent 用同一套代码：

```typescript
async function runAgent(task: string, tools: Tool[]): Promise<string> {
  const messages: Message[] = [{ role: "user", content: task }];
  
  while (true) {
    const response = await callLLM(messages, tools);
    messages.push({ role: "assistant", content: response.content });
    
    if (response.stop_reason === "tool_use") {
      for (const toolUse of response.tool_uses) {
        // 关键：如果工具是 "spawn_subagent"，递归调用 runAgent
        if (toolUse.name === "spawn_subagent") {
          const subResult = await runAgent(toolUse.input.task, subAgentTools);
          messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, content: subResult }] });
        } else {
          const result = await executeTool(toolUse);
          messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, content: result.content }] });
        }
      }
    } else {
      return response.text; // 子 Agent 完成，返回结果给调用者
    }
  }
}
```

从主 Agent 的角度看，"启动子 Agent"就是一个工具调用——工具名叫 `spawn_subagent`，参数是子任务描述，返回值是子 Agent 的最终回复。主 Agent 不知道也不关心子 Agent 内部又跑了个 Agent Loop。

这就是**分形**：不管你放大哪一层，结构都一样。主 Agent、子 Agent、子子 Agent，都是同一个 `runAgent` 函数的不同调用。复杂度来自组合，不是来自结构差异。

### 8.4 子智能体的边界

子 Agent 不是万能的：

- 它有自己的上下文，意味着**不能共享主 Agent 的中间状态**。如果子 Agent 需要主 Agent 已经读过的文件内容，要么重新读，要么主 Agent 在派发时把内容塞进 task 描述。
- 它有自己的工具集，可能**没有主 Agent 的某些工具**。比如子 Agent 可能不能调 `spawn_subagent`（防止无限递归）。
- 它的失败**要主 Agent 处理**。子 Agent 跑崩了，主 Agent 收到一个错误 tool_result，得决定重试还是换方案。

---

## 9. 完整架构图

把前面所有部分串起来，Claude Code 的完整架构：

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Claude Code 整体架构                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  CLI 层（readline）                                          │   │
│  │  职责：读用户输入、显示输出                                   │   │
│  └────────────────────────┬────────────────────────────────────┘   │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Agent Loop（两层循环）                                      │   │
│  │                                                             │   │
│  │  外层: while True                                            │   │
│  │    user_input = readline()                                  │   │
│  │    messages.push(user_input)                                │   │
│  │                                                             │   │
│  │    内层: while True                                          │   │
│  │      ┌─────────────────────────────────────────────────┐    │   │
│  │      │  上下文管理                                       │    │   │
│  │      │  - 截断/压缩 messages 到 token 限制内             │    │   │
│  │      │  - 构造 system prompt（动态注入环境信息）          │    │   │
│  │      └─────────────────────────────────────────────────┘    │   │
│  │                                                             │   │
│  │      ┌─────────────────────────────────────────────────┐    │   │
│  │      │  LLM 调用（流式）                                  │    │   │
│  │      │  - 发送 messages + tools + system                  │    │   │
│  │      │  - 接收事件流: text_delta / input_json_delta       │    │   │
│  │      │  - 累积成完整 response                              │    │   │
│  │      └─────────────────────────────────────────────────┘    │   │
│  │                                                             │   │
│  │      messages.push(assistant_response)                      │   │
│  │                                                             │   │
│  │      if stop_reason == "tool_use":                          │   │
│  │        ┌───────────────────────────────────────────────┐    │   │
│  │        │  工具执行                                       │    │   │
│  │        │  for each tool_use:                              │    │   │
│  │        │    ┌──────────────────────────────────────┐    │    │   │
│  │        │    │  权限检查                               │    │    │   │
│  │        │    │  - 自动允许 / 需确认 / 禁止              │    │    │   │
│  │        │    └──────────────────────────────────────┘    │    │   │
│  │        │    if 允许:                                     │    │   │
│  │        │      ┌──────────────────────────────────────┐  │    │   │
│  │        │      │  执行工具                               │  │    │   │
│  │        │      │  - read_file / write_file / edit_file  │  │    │   │
│  │        │      │  - run_command / grep / glob           │  │    │   │
│  │        │      │  - spawn_subagent → 递归 Agent Loop    │  │    │   │
│  │        │      └──────────────────────────────────────┘  │    │   │
│  │        │    messages.push(tool_result)                  │    │   │
│  │        │  else:                                           │    │   │
│  │        │    messages.push(拒绝的 tool_result)            │    │   │
│  │        └───────────────────────────────────────────────┘    │   │
│  │        continue  ← 继续内层                                │   │
│  │      else:                                                  │   │
│  │        显示(response.text)                                  │   │
│  │        break  ← 回外层                                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  工具层                                                      │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │   │
│  │  │ 文件操作 │ │ 命令执行 │ │ 搜索     │ │ 子智能体     │   │   │
│  │  │ read     │ │ run_cmd  │ │ grep     │ │ spawn_sub    │   │   │
│  │  │ write    │ │          │ │ glob     │ │ agent        │   │   │
│  │  │ edit     │ │          │ │          │ │              │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  API 层（@anthropic-ai/sdk）                                 │   │
│  │  职责：封装 HTTP 请求、流式解析、错误重试                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

数据流（一次完整的工具调用）：

```
用户输入
  ↓
外层循环: push 到 messages
  ↓
内层循环:
  ↓
构造 system prompt（动态）
  ↓
检查 token，必要时截断 messages
  ↓
调用 API（流式）: messages + tools + system
  ↓
接收事件流，累积成 response
  ↓
push response 到 messages
  ↓
response 有 tool_use?
  ├─ 有 → 权限检查 → 执行工具 → push tool_result → 继续内层
  └─ 无 → 显示文本 → break 内层 → 继续外层
```

---

## 10. 关键设计哲学

理解架构不只是记住组件，更要理解每个设计决策背后的"为什么"。以下是 Claude Code 的核心设计哲学。

### 10.1 模型决策，代码执行

**原则**：做什么由模型决定，怎么做由代码执行。

模型决定"读哪个文件"、"执行什么命令"、"修改哪一行"。代码负责"真的去读"、"真的去执行"、"真的去改"。

**为什么这样设计**：因为模型的强项是"理解意图、规划步骤"，代码的强项是"可靠执行、精确操作"。让模型决定步骤，能处理模糊需求（"帮我修 bug"）；让代码执行操作，能保证可靠性（不会"差不多"读文件）。

**反例**：如果让代码决定步骤（写死的流程），就只能处理预设场景，遇到新需求就歇菜。如果让模型执行操作（模型直接调系统 API），就没有权限检查、错误处理、日志记录的余地。

### 10.2 messages 是唯一状态

**原则**：整个 Agent 的状态就是 `messages` 数组。没有别的全局变量记录"Agent 在干什么"。

**为什么这样设计**：因为 LLM 是无状态的，每次调用都要传完整历史。既然必须维护 messages，就让它成为唯一的状态来源。所有信息（用户说了什么、模型回了什么、工具返回了什么）都在 messages 里。

**好处**：
- 可调试：看 messages 就知道 Agent 干了什么
- 可恢复：存下 messages，下次加载就能继续
- 可重放：用同样的 messages 调 API，行为可复现

**反例**：如果还有别的状态（比如 `currentTask`、`filesRead`、`commandsRun`），就要维护多份状态的一致性，调试时要在多个地方拼凑"到底发生了什么"。

### 10.3 循环即自主

**原则**：Agent 的自主性来自循环，不是来自"智能"。

模型本身没有"持续工作"的能力——它就是调一次返回一次。是**循环**让 Agent 能"持续决策直到完成"。循环是自主性的载体。

**为什么这样设计**：把"智能"和"持续"解耦。模型负责单次决策的智能，循环负责跨次决策的持续。两者组合就是自主智能体。

**推论**：要控制 Agent 的自主程度，调循环就行。限制循环次数 = 限制自主度。`max_turns=10` 就是"最多自主 10 步"。

### 10.4 工具是手脚，不是嘴巴

**原则**：工具是用来"做事"的，不是用来"说话"的。

工具的返回值是给模型看的"数据"，不是给用户看的"消息"。模型把工具返回的数据"理解"后，自己组织语言告诉用户。

**为什么这样设计**：让模型做"信息过滤和表达"的中间层。工具返回原始数据（比如文件全文），模型决定"用户需要知道哪些"（比如只说"找到了 3 处错误"而不把整个文件贴出来）。

**反例**：如果工具直接把结果显示给用户，模型就失去了"总结、过滤、解释"的机会，用户体验会变差（被原始数据淹没）。

### 10.5 权限是安全阀，不是刹车

**原则**：权限在"出事前"拦截，不是"出事后"补救。

权限检查在工具执行**之前**，不是之后。操作还没发生就检查"能不能做"，不能做就直接拒绝，操作根本不执行。

**为什么这样设计**：因为有些操作不可逆。`rm -rf` 执行了就没了，事后发现"不该执行"也来不及。必须事前拦住。

**推论**：权限不能依赖"检测操作结果"——因为结果可能不存在了。权限必须依赖"分析操作意图"——看工具名和参数就判断，不等执行。

### 10.6 流式是体验，不是逻辑

**原则**：流式改变的是"什么时候显示"，不是"做什么"。

流式和非流式的 Agent Loop 逻辑完全一样——都是"调 LLM → 看有没有 tool_use → 执行工具 → 继续"。流式只是把"等完整响应再处理"变成"边收边处理"。

**为什么这样设计**：让逻辑和体验解耦。先写非流式版把逻辑跑通，再加流式包装体验。不要一上来就写流式，会被流式的事件处理淹没，看不清核心逻辑。

---

## 11. 常见误解

### 11.1 误解一："Agent 是更聪明的聊天机器人"

**误解**：觉得 Agent 就是聊天机器人加了点功能，本质还是"用户问 AI 答"。

**真相**：Agent 和聊天机器人是**不同物种**。聊天机器人没有自主性——每轮都要用户输入。Agent 有自主性——用户给个目标，Agent 自己跑很多轮，中间不需要用户参与。

类比：聊天机器人是"客服"，你问她答。Agent 是"外包工"，你给需求他自己干完交付。

### 11.2 误解二："模型直接执行工具"

**误解**：觉得模型"调用"了工具，工具就执行了，模型和工具直接相连。

**真相**：模型从不直接执行任何东西。模型只是**说**"我想调这个工具"，是你的**代码**去真正执行。模型和工具之间永远隔着你的代码。这层隔断是安全性的基础——你可以在这一层做权限检查、参数校验、结果过滤、日志记录。

### 11.3 误解三："上下文窗口够大就不用管"

**误解**：觉得 200K token 很大，普通任务用不完，不用操心上下文管理。

**真相**：200K 看起来大，但 tool_result 极其吃 token。读一个 2000 行的文件就 1 万多 token，读 20 个就 20 万。一个"分析整个代码库"的任务，几轮就把上下文塞满了。上下文管理是 Agent 工程化的**必做项**，不是"优化"。

### 11.4 误解四："System Prompt 是提示词"

**误解**：觉得 system prompt 就是"给模型的提示"，写几句"你是个好助手"就行。

**真相**：System Prompt 是**规则注入**，定义 Agent 的行为规范。它有结构（身份、能力、规则、环境、工具提示），有动态部分（当前目录、时间、Git 状态），有约束力（模型倾向于遵循）。把它当"提示词"随便写两句，Agent 行为就会飘忽不定。

### 11.5 误解五："流式能加速 Agent"

**误解**：觉得流式响应能让 Agent 跑得更快。

**真相**：流式**不减少总时间**，只是让用户**更早看到部分结果**。模型生成 10 秒的回复，流式是"0 秒开始显示，10 秒显示完"，非流式是"10 秒开始显示，10 秒显示完"。总时间都是 10 秒。流式改善的是**感知延迟**，不是**实际延迟**。

（严格说，流式能让工具调用更早开始，从而略微减少总时间。但主要价值还是体验。）

### 11.6 误解六："权限会拖慢 Agent"

**误解**：觉得每次工具调用都要权限检查，太慢了，影响 Agent 效率。

**真相**：权限检查本身是**极快**的（就是几个字符串匹配），开销可以忽略。真正"慢"的是**需要用户确认**的操作——那要等用户按 y/n。但这正是权限的价值：在危险操作前停一下，让用户决定。如果嫌慢全放行，模型一个幻觉就能删库。

### 11.7 误解七："子智能体是为了并行"

**误解**：觉得子智能体的主要价值是并行加速。

**真相**：子智能体的**主要价值是上下文隔离**，并行只是副作用。即使不并行，子智能体也能避免主 Agent 上下文爆炸——子 Agent 在自己的上下文里干活，主 Agent 只收摘要。并行是锦上添花，上下文隔离才是雪中送炭。

### 11.8 误解八："messages 里 tool_result 用 user 角色是设计缺陷"

**误解**：觉得 tool_result 用 `role: "user"` 是 API 设计得不好，应该有专门的 `role: "tool"`。

**真相**：这是格式约束下的**最优解**。API 只支持 user/assistant/system 三种角色，对话必须 user/assistant 交替。tool_result 是"外界给模型的信息"，语义上和 user 输入同类，放 user 既符合格式又符合语义。这不是缺陷，是简洁设计。

---

## 12. 前置知识检查清单

读后续章节前，确认你理解了以下每一点。如果某点不确定，回头重读对应小节。

- [ ] **LLM 是无状态函数**：每次调用不记得上次，"记忆"是代码维护的 messages 数组（§0.1）
- [ ] **API 本质是 HTTP**：SDK 只是封装，底层是 HTTP 请求/响应（§0.2）
- [ ] **Agent = LLM + 工具 + 循环**：三者缺一不可（§0.3）
- [ ] **两层循环的分工**：外层等用户，内层让模型自主跑（§2.3）
- [ ] **内层循环是 Agent 本质**：去掉内层循环就不是 Agent 了（§2.4）
- [ ] **stop_reason 的含义**：`tool_use` 继续，`end_turn` 结束（§2.5, §3.3）
- [ ] **tool_use 三步骤**：定义工具 → 模型请求 → 代码执行返回结果（§3.1）
- [ ] **tool_result 是 user 角色**：因为它是"外界给模型的信息"（§3.5）
- [ ] **多 tool_result 在一条 user 消息里**：不是分多条（§3.4）
- [ ] **流式有两种 delta**：text_delta 拼文本，input_json_delta 拼工具参数 JSON（§4.4）
- [ ] **工具参数也是流式**：因为模型生成一切都是 token by token（§4.5）
- [ ] **System Prompt 是规则注入**：不是"提示词"，是行为规范（§5.2）
- [ ] **System Prompt 动态生成**：环境信息每次重新构造（§5.4）
- [ ] **System Prompt 是软约束**：硬约束靠权限模型（§5.5）
- [ ] **messages 只增不减**：token 会涨，必须管理（§6.2）
- [ ] **tool_result 最吃 token**：上下文管理主要管它（§6.3）
- [ ] **三种上下文策略**：截断、压缩、外挂记忆（§6.4）
- [ ] **权限在执行前检查**：事前拦截，不是事后补救（§7.3, §10.5）
- [ ] **权限拒绝返回 tool_result**：不抛异常，让模型看到拒绝原因（§7.4）
- [ ] **子智能体是递归**：子 Agent 和主 Agent 用同一套代码（§8.3）
- [ ] **子智能体主要价值是上下文隔离**：不是并行（§8.2, §11.7）
- [ ] **messages 是唯一状态**：没有别的全局变量记录 Agent 状态（§10.2）
- [ ] **模型决策，代码执行**：模型说做什么，代码真的做（§10.1）

---

## 13. 扩展思考题

以下问题没有标准答案，但思考它们能加深理解。建议读完整章后逐个想一遍，能想多少想多少。

**题 1**：如果把内层循环的终止条件从"模型不调工具"改成"调了 N 次工具就强制停"，Agent 的行为会怎么变？什么场景下这种改法有用？什么场景下会出问题？

**题 2**：如果模型一次返回了 5 个 tool_use，但其中 3 个有依赖关系（比如先创建目录再写文件），代码该怎么处理？并行执行会出什么问题？怎么检测依赖？

**题 3**：tool_result 的 `content` 可以是字符串，也可以是结构化对象（比如 `{type: "image", source: {...}}`）。什么场景下返回图片比返回文本有用？模型能"看懂"图片 tool_result 吗？

**题 4**：System Prompt 里写"不要执行 rm -rf"，和权限模型里禁止 `rm -rf`，有什么区别？哪个更可靠？为什么不能只靠其中一个？

**题 5**：如果上下文窗口无限大（比如 1 亿 token），还需要上下文管理吗？还需要子智能体吗？为什么？

**题 6**：流式响应中途网络断了，代码已经收到一半的 text_delta 和一半的 input_json_delta，但 message_stop 事件没来。代码该怎么处理？能"续传"吗？还是必须重来？

**题 7**：子智能体如果也调用 `spawn_subagent`，就形成了递归。怎么防止无限递归？给递归深度设上限够吗？还有什么更好的办法？

**题 8**：messages 是唯一状态，那"当前工作目录"是状态吗？它存在哪里？如果用户在 Agent 跑的过程中 `cd` 了，Agent 会知道吗？

**题 9**：模型在 tool_use 里传了 `read_file({path: "../../../etc/passwd"})`，代码该怎么处理？这是权限问题还是参数校验问题？两者怎么分？

**题 10**：如果让两个 Agent 互相对话（A 的输出是 B 的输入，B 的输出是 A 的输入），会形成什么？这和子智能体有什么关系？有什么实际用途？

**题 11**：Claude Code 的工具是预定义的（read_file、run_command 等）。如果让模型**自己发明工具**（比如模型写一个新工具的代码，然后加载使用），架构要怎么改？有什么安全风险？

**题 12**：messages 数组里存的是结构化对象（role + content）。如果改成只存"对话的纯文本"（把结构序列化成字符串），会损失什么？为什么必须用结构化对象？

**题 13**：Agent Loop 是 `while True`。如果改成事件驱动（每个工具完成触发下一轮，而不是 while 循环），架构会怎么变？有什么好处和坏处？

**题 14**：权限模型里"自动允许"的操作（如 read_file）真的无害吗？读一个包含密钥的文件并显示给用户，算不算"副作用"？怎么处理这种"只读但不该读"的情况？

**题 15**：如果模型每次调工具前都"解释一下为什么要调这个工具"（在 text 里说原因，再发 tool_use），和直接发 tool_use 不解释，对用户体验有什么影响？对 Agent 性能有什么影响？

---

> **下一步**：带着这套心智模型去读第 1 章（项目骨架）。你会发现，每一行代码都在实现本章描述的某个组件——CLI 实现 readline 层，`agentLoop` 实现两层循环，`toolDefinitions` 实现工具层，`callLLM` 实现 API 层。骨架先立起来，血肉再长上去。
