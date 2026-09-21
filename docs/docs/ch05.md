# 第五章：System Prompt 工程

> 从"随机行为"到"合理行为"。System Prompt 是约束模型行为的规则注入。

## 目标

理解 System Prompt 的结构层次，掌握动态环境注入，体会 prompt 对模型行为的影响。

## 核心原理

### System Prompt 不是"提示词"

System Prompt 是**规则注入**。它定义了模型在本次会话中的行为边界。

没有 system prompt：
- 模型可能写一堆注释
- 可能用低效的方式搜索（逐个 read_file 而非 grep）
- 可能执行危险命令
- 不知道当前项目是什么

有了 system prompt：
- 模型知道用 grep 搜索而非逐个读文件
- 知道不写多余注释
- 知道不执行 rm -rf
- 知道当前工作目录、git 状态

### 结构层次

```
System Prompt = 
  ① 身份定义        "你是代码助手"
  ② 工具使用规则    "优先用 grep 搜索"
  ③ 代码风格约束    "不添加多余注释"
  ④ 安全约束        "不执行 rm -rf"
  ⑤ 环境信息        "工作目录: /project, Git: main"
```

前四层是**静态规则**，第五层是**动态注入**。

### 动态环境注入

```typescript
function buildSystemPrompt() {
  return `
你是代码助手。
工作目录: ${process.cwd()}        // 动态
Git分支: ${gitBranch()}           // 动态
操作系统: ${process.platform}     // 动态
日期: ${new Date()}              // 动态
  `;
}
```

这让模型知道"我在哪"、"项目什么状态"，从而做出更合理的决策。比如知道是 git 仓库，就不会建议 `git init`。

## 代码结构

```
ch05-system-prompt/
├── main.ts
├── tools/
├── prompts/
│   └── system.ts      # System prompt 生成器
└── .env.example
```

### prompts/system.ts

```typescript
export function buildSystemPrompt(): string {
  const cwd = process.cwd();
  const branch = execSync("git rev-parse --abbrev-ref HEAD")...;
  
  return `你是代码助手...
## 工具使用规则
- 读取单个文件用 read_file，搜索用 grep
- 修改优先用 edit_file，新建用 write_file
...
## 环境信息
- 工作目录: ${cwd}
- Git: ${branch}
  `;
}
```

### main.ts 的变化

唯一变化：`messages.create()` 加了 `system` 参数：

```typescript
const stream = client.messages.stream({
  model,
  max_tokens: maxTokens,
  system: systemPrompt,  // ← 新增
  messages,
  tools,
});
```

## 运行方式

```bash
cd lessons/ch05-system-prompt
npm install
cp .env.example .env
npx tsx main.ts
```

启动时会先打印 system prompt 预览，让你看到注入了什么。

对比 Ch4 和 Ch5 的模型行为差异：
- Ch5 模型更倾向用 grep 搜索而非逐个读文件
- Ch5 模型不写多余注释
- Ch5 模型知道当前目录和 git 状态

## 与真实 Claude Code 对比

| 方面 | 本章 | Claude Code |
|------|------|-------------|
| prompt 长度 | ~400 字 | 数千字 |
| 工具规则 | 基本原则 | 每个工具有详细使用规则 |
| 项目感知 | git 分支 + 变更数 | 检测 npm/cargo/go 等项目类型 |
| AGENTS.md | 无 | 支持项目级 prompt 覆盖 |
| 动态注入 | cwd, git, os, date | + package.json, 目录结构, 最近改动 |

Claude Code 的 system prompt 极其详细，几乎为每个工具都写了使用规则和注意事项。本章展示的是核心结构。

## 下一章预告

现在模型行为合理了，但 `messages` 数组会无限增长——长对话会超出上下文窗口限制。下一章实现上下文管理：token 计数、截断、压缩。