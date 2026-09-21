# 第六章：上下文管理

> 处理 200K token 限制，支持长对话不崩。

## 目标

理解上下文窗口限制、token 计数、截断策略和对话压缩。

## 核心原理

### 问题

LLM 有上下文窗口限制（Claude: 200K tokens）。`messages` 数组太长就超限，API 报错。

### 上下文增长来源

```
messages 数组增长来源:
  1. 用户输入         — 每轮几十到几百 token
  2. 模型回复         — 几百到几千 token
  3. 工具调用请求      — 较小
  4. 工具执行结果      — 可能非常大！（读一个文件几千行）
```

**工具结果是上下文膨胀的主要来源。** 一次 `read_file` 读大文件，可能就占了几万 token。

### 三种策略

| 策略 | 做法 | 触发时机 |
|------|------|----------|
| 工具结果截断 | 大输出只保留头尾 | 每次工具执行后 |
| 历史截断 | 保留最近 N 条消息 | 接近限制时 |
| 对话压缩 | 用模型总结旧对话 | 接近限制时 |

## 代码结构

```
ch06-context/
├── main.ts
├── tools/
├── prompts/
├── context.ts        # 上下文管理器
└── .env.example
```

### context.ts — ContextManager

```typescript
class ContextManager {
  private messages: MessageParam[] = [];
  private maxTokens: number;
  private lastUsage: { input_tokens, output_tokens };

  // 状态监控
  getTokenCount(): number          // 当前 token 数
  isNearLimit(): boolean           // 是否接近限制（80%）
  isOverLimit(): boolean           // 是否超限（95%）
  getStatus(): string              // 状态字符串

  // 策略
  truncateToolResults(maxLen)      // 截断大工具结果
  truncateHistory(keepRecent)      // 截断旧消息
  async compress(client, model)    // 用模型压缩历史
}
```

### 三种策略详解

**1. 工具结果截断**（每次工具执行后）

```typescript
truncateToolResults(maxResultLength = 10000) {
  // 遍历所有 tool_result，超长的截断保留头尾
  if (result.length > 10000) {
    result = head(5000) + "...(已截断)..." + tail(5000);
  }
}
```

**2. 历史截断**（接近限制时）

```typescript
truncateHistory(keepRecent = 10) {
  // 直接丢弃旧消息，只保留最近 10 条
  this.messages = this.messages.slice(-10);
}
```

**3. 对话压缩**（接近限制时）

```typescript
async compress(client, model) {
  // 用模型总结旧对话
  const summary = await client.messages.create({
    messages: [{ role: "user", content: `请总结以下对话:\n${oldMessages}` }]
  });
  // 用总结替换旧消息
  this.messages = [{ role: "user", content: summary }, ...recentMessages];
}
```

压缩比截断更好，因为保留了关键信息，但多一次 API 调用。

### main.ts 的变化

```typescript
// 每轮后更新 usage
if (usage) ctx.updateUsage(usage);

// 截断大工具结果
ctx.truncateToolResults();

// 接近限制时压缩或截断
if (ctx.isNearLimit()) {
  const compressed = await ctx.compress(client, model);
  if (!compressed) ctx.truncateHistory(10);
}

// 每轮结束显示上下文状态
console.log(ctx.getStatus());
```

## 运行方式

```bash
cd lessons/ch06-context
npm install
cp .env.example .env
npx tsx main.ts
```

每轮结束会显示上下文使用率。长时间对话时会看到压缩/截断的日志。

## 与真实 Claude Code 对比

| 方面 | 本章 | Claude Code |
|------|------|-------------|
| token 计数 | API usage 返回 | 用 tokenizer 精确计数 |
| 截断策略 | 头尾保留 | 智能截断（保留关键信息） |
| 压缩 | 用模型总结 | `compactConversation` 专用 prompt |
| 触发时机 | 80% 预警，95% 强制 | 多级阈值 |
| 状态显示 | token 数 + 百分比 | 同 |

## 下一章预告

现在长对话不会崩了，但模型执行 `rm -rf` 也不会拦——很危险。下一章加权限系统，危险操作前确认。