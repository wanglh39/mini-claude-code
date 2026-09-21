# 第三章：完整工具集 — Edit/Bash/Glob/Grep

> 6 个工具，让模型真正能干活：读写编辑文件、执行命令、搜索代码。

## 目标

理解每个工具的设计思路和实现方式，以及工具模块化组织。

## 工具一览

| 工具 | 功能 | 关键实现 |
|------|------|----------|
| `read_file` | 读取文件 | `fs.readFileSync`，大文件截断 |
| `write_file` | 写入文件 | `fs.writeFileSync`，自动建目录 |
| `edit_file` | 精确编辑 | 字符串替换，唯一匹配校验 |
| `bash` | 执行命令 | `child_process.exec`，超时控制 |
| `glob` | 文件搜索 | 递归遍历 + 模式匹配 |
| `grep` | 内容搜索 | 逐文件正则匹配 |

## 各工具设计要点

### edit_file — 精确替换

Edit 不是覆盖整个文件，而是**找到 oldString，替换为 newString**。

关键约束：**oldString 必须唯一匹配**。如果文件里有多个匹配，报错让模型提供更多上下文。

```typescript
const occurrences = content.split(input.oldString).length - 1;
if (occurrences === 0) return "错误: 未找到匹配";
if (occurrences > 1) return "错误: 多处匹配，请提供更多上下文";
```

为什么要求唯一？因为模糊替换可能改错地方。强制唯一让模型必须提供足够上下文，保证精确编辑。

### bash — 命令执行

```typescript
exec(command, { timeout: 120000, maxBuffer: 10MB }, callback);
```

- `timeout`：防止命令卡死
- `maxBuffer`：防止输出爆内存
- 返回 stdout + stderr + exit code

### glob — 文件搜索

递归遍历目录，跳过 `node_modules` 和 `.git`，用正则匹配文件路径。

### grep — 内容搜索

逐文件读取，正则匹配每一行，返回 `文件名:行号: 内容` 格式。限制 200 条结果防止输出过大。

## 代码结构

```
ch03-tools-full/
├── main.ts
├── tools/
│   ├── index.ts    # 工具注册表 + 统一执行入口
│   ├── read.ts
│   ├── write.ts
│   ├── edit.ts
│   ├── bash.ts
│   ├── glob.ts
│   └── grep.ts
└── .env.example
```

每个工具一个文件，导出 `tool` 定义和 `execute` 函数。`index.ts` 汇总注册。

## 运行方式

```bash
cd lessons/ch03-tools-full
npm install
cp .env.example .env
npx tsx main.ts
```

试试这些指令：
- "列出当前目录所有 .ts 文件"
- "搜索包含 import 的行"
- "创建一个 hello.py，内容是 print('hello')"
- "运行 python hello.py"
- "把 hello.py 里的 hello 改成 world，然后运行"

## 与真实 Claude Code 对比

| 方面 | 本章 | Claude Code |
|------|------|-------------|
| read_file | 无分页 | 支持 offset + limit |
| edit_file | 唯一匹配校验 | 同样要求唯一 + replaceAll 选项 |
| bash | exec + timeout | 有工作目录注入、环境变量、shell 配置 |
| glob | 手写递归 | 用 fast-glob 库，支持更多语法 |
| grep | 手写遍历 | 用 ripgrep（rg），更快 |
| 错误处理 | 返回错误文本 | 结构化错误 + 重试建议 |

## 下一章预告

现在模型能干活了，但输出是"等全部生成再显示"，体验不好。下一章改成流式输出，逐字显示，体验接近真实 Claude Code。