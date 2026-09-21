# 第四章：流式输出

> 从"等全部生成"到"逐字显示"，体验接近真实 Claude Code。

## 目标

理解流式 API 的事件模型，掌握 `text_delta` 和 `input_json_delta` 的处理方式。

## 核心原理

### 非流式 vs 流式

```
非流式 (Ch3):
  请求 → ............等待............ → 一次性返回完整结果
  用户体验: 等很久 → 突然出一大段

流式 (Ch4):
  请求 → 逐 token 推送 → 逐 token 显示
  用户体验: 立即开始输出，像打字一样
```

### 事件流

```
message_start           ← 消息开始
│
├── content_block_start (index=0, type="text")
│   ├── content_block_delta (text_delta: "我")    ← 逐字推送
│   ├── content_block_delta (text_delta: "来")
│   ├── content_block_delta (text_delta: "读")
│   └── content_block_stop
│
├── content_block_start (index=1, type="tool_use")
│   ├── content_block_delta (input_json_delta: '{"path"')   ← 工具参数也是碎片
│   ├── content_block_delta (input_json_delta: ': "main.ts"}')
│   └── content_block_stop
│
├── message_delta (stop_reason="tool_use")
└── message_stop
```

### 两种 delta

- **`text_delta`**：文本增量，直接 `process.stdout.write()` 输出
- **`input_json_delta`**：工具参数 JSON 的碎片，需要拼接，等 `content_block_stop` 后 `JSON.parse()`

工具参数为什么也是流式的？因为模型生成 JSON 和生成文本一样，是逐 token 的。`{"path": "main.ts"}` 可能被拆成 `{"path`、`": "main`、`.ts"}` 三段推送。

## 代码关键部分

```typescript
const stream = client.messages.stream({ model, messages, tools });

for await (const event of stream) {
  switch (event.type) {
    case "content_block_delta":
      if (delta.type === "text_delta") {
        process.stdout.write(delta.text);  // 文本直接输出
      } else if (delta.type === "input_json_delta") {
        buffer += delta.partial_json;      // 工具参数拼接
      }
      break;
    case "content_block_stop":
      if (buffer) {
        input = JSON.parse(buffer);        // 拼完了再解析
      }
      break;
  }
}
```

### 组装完整 content

流式处理后，需要把碎片组装成完整的 `content` 数组，加入 `messages`：

```typescript
const contentBlocks = [];
// 流式过程中填充 contentBlocks[index].text / .input
messages.push({ role: "assistant", content: contentBlocks });
```

## 运行方式

```bash
cd lessons/ch04-streaming
npm install
cp .env.example .env
npx tsx main.ts
```

你会看到模型回复是逐字输出的，而不是等很久才一次性出现。

## 与真实 Claude Code 对比

| 方面 | 本章 | Claude Code |
|------|------|-------------|
| 流式 API | `messages.stream()` | 同 |
| 文本输出 | `stdout.write` | 有颜色、markdown 渲染 |
| 工具调用显示 | 简单文本 | 有 spinner、进度、diff 视图 |
| 事件处理 | for await | 同 |

核心事件处理逻辑完全一致，差异在终端渲染的丰富度。

## 下一章预告

现在输出体验好了，但模型行为还比较"随机"——它可能写一堆注释、可能用低效的方式搜索。下一章设计 System Prompt，约束模型行为到合理范围。