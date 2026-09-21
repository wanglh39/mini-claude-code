# 第二章：加工具 — Read/Write

> 从"聊天机器人"到"Agent"的质变。理解 tool_use 协议和内层 agentic loop。

## 目标

理解两件事：
1. **tool_use 协议** — 模型如何"请求"调用工具，工具结果如何回传
2. **内层 agentic loop** — 工具调用可能连续多轮，模型看完一个工具结果后可能再调下一个

## 核心原理

### 从单轮到内层循环

Ch1 的循环是：

```
用户输入 → 调 LLM → 输出 → 等用户
```

Ch2 多了一层内层循环：

```
用户输入 → ┌─ 调 LLM → 想调工具？ ─┬─ 是 → 执行工具 → 结果回传 ─┐
           └───────────────────────┴───────────────────────────┘
                                   └─ 否 → 输出 → 等用户
```

**内层循环是 Agent 的本质。** 模型不是被调一次就完，而是"调一次→看结果→再决定→再调..."，直到它认为任务完成（`stop_reason: "end_turn"`）。

### 一次完整的工具调用流程

```
用户: "创建一个 hello.txt，内容是 Hello World"

messages.push({role: "user", content: "创建一个 hello.txt..."})

→ 调用 LLM (带 tools=[read_file, write_file])
← response:
    stop_reason = "tool_use"
    content = [
      { type: "text", text: "我来创建这个文件" },
      { type: "tool_use", id: "toolu_xxx", name: "write_file",
        input: { path: "hello.txt", content: "Hello World" } }
    ]

→ 执行工具: fs.writeFileSync("hello.txt", "Hello World")
→ messages.push({
    role: "user",
    content: [{ type: "tool_result", tool_use_id: "toolu_xxx",
                content: "已成功写入文件: hello.txt" }]
  })

→ 继续内层循环，调用 LLM
← response:
    stop_reason = "end_turn"
    content = [{ type: "text", text: "已创建 hello.txt，内容为 Hello World" }]

→ 输出给用户
→ break 内层循环，等用户下一轮
```

### tool_use 协议三步骤

```
① 定义工具：告诉模型有哪些工具可用
② 模型请求：response 中出现 tool_use block
③ 回传结果：构造 tool_result 消息，继续循环
```

## 代码结构

```
ch02-tools-basic/
├── main.ts     # Agent loop（含内层工具循环）
├── tools.ts    # 工具定义 + 执行函数
└── .env.example
```

### tools.ts — 工具定义

每个工具需要三样东西：
```typescript
{
  name: "read_file",           // 工具名
  description: "读取文件内容",   // 告诉模型这个工具做什么
  input_schema: {               // JSON Schema 定义参数
    type: "object",
    properties: {
      path: { type: "string" }
    },
    required: ["path"]
  }
}
```

`description` 和 `input_schema` 是模型理解工具的唯一途径。写得好，模型就能正确使用；写得差，模型就会乱调。

### main.ts — 内层循环的关键

```typescript
while (true) {  // 内层 agentic loop
  const response = await client.messages.create({ model, messages, tools });
  messages.push({ role: "assistant", content: response.content });

  if (response.stop_reason === "tool_use") {
    // 执行所有工具调用
    const toolResults = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const result = executeTool(block.name, block.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,  // 关联到哪个工具调用
          content: result,
        });
      }
    }
    messages.push({ role: "user", content: toolResults });
    // 不 break，继续循环
  } else {
    // end_turn，模型说完了
    console.log(extractText(response));
    break;
  }
}
```

**关键理解**：
- `tool_use_id` 把工具调用和结果关联起来
- 工具结果作为 `role: "user"` 消息回传（不是 assistant）
- 一次 response 可能包含多个工具调用（并行）
- 内层循环不 break，模型看到工具结果后会决定下一步

## 运行方式

```bash
cd lessons/ch02-tools-basic
npm install
cp .env.example .env
# 编辑 .env，填入 API_KEY
npx tsx main.ts
```

试试这些指令：
- "创建一个 test.txt，内容是你好"
- "读取 test.txt 的内容"
- "创建一个 src 目录下的 utils.ts，内容是一个加法函数"
- "读取刚才创建的 utils.ts"

## 与真实 Claude Code 对比

| 方面 | 本章 | Claude Code |
|------|------|-------------|
| 工具数量 | 2 个（read, write） | 10+ 个 |
| 权限确认 | 无，直接执行 | 写操作需确认 |
| 参数校验 | 基本校验 | 严格校验 + 错误提示 |
| 工具实现 | 函数 + switch | 类（class），有 validate/checkPermissions/execute |
| 错误处理 | try-catch 返回错误文本 | 结构化错误 + 重试逻辑 |

**核心循环完全一致。** Claude Code 的工具执行也是这个模式：检查 stop_reason → 执行工具 → 构造 tool_result → 继续循环。

## 下一章预告

现在模型能读写文件了，但还不能修改文件（只能覆盖）、不能执行命令、不能搜索代码。下一章加入 Edit/Bash/Glob/Grep，让模型真正能干活。