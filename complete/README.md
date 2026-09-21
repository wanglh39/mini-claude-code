# Mini Claude Code — 完整版

> 把 `lessons/ch09-final/src/` 原封不动复制过来，多文件，内容与各章教学版完全一致。

## 目录结构

```
complete/
├── src/
│   ├── main.ts           # 入口：解析参数 → 启动
│   ├── cli.ts            # CLI 参数解析 (Ch9)
│   ├── config.ts         # 配置加载 (Ch9)
│   ├── agent-loop.ts     # 核心循环：双层 while + 流式 (Ch1-Ch4)
│   ├── tools/            # 完整工具集 (Ch3)
│   │   ├── index.ts      #   工具注册表
│   │   ├── read.ts       #   read_file
│   │   ├── write.ts      #   write_file
│   │   ├── edit.ts       #   edit_file
│   │   ├── bash.ts       #   bash
│   │   ├── glob.ts       #   glob
│   │   └── grep.ts       #   grep
│   ├── prompts/
│   │   └── system.ts     # System Prompt 生成器 (Ch5)
│   ├── context.ts        # 上下文管理器 (Ch6)
│   ├── permission.ts     # 权限系统 (Ch7)
│   └── subagent.ts       # 子智能体 (Ch8)
├── package.json
├── .env.example
└── README.md
```

## 各文件对应的章节

| 文件 | 来源 | 功能 |
|------|------|------|
| `main.ts` | Ch1 + Ch9 | 入口、外层循环 |
| `cli.ts` | Ch9 | CLI 参数解析 |
| `config.ts` | Ch9 | 配置加载 |
| `agent-loop.ts` | Ch1-Ch4 | 双层循环 + 流式输出 |
| `tools/*.ts` | Ch3 | 6 个工具定义与执行 |
| `prompts/system.ts` | Ch5 | System Prompt + 动态环境注入 |
| `context.ts` | Ch6 | token 监控 + 截断 + 压缩 |
| `permission.ts` | Ch7 | 确认 gate + 危险命令检测 |
| `subagent.ts` | Ch8 | Task 工具 + 子 Agent 独立循环 |

## 运行

```bash
cd complete
npm install
cp .env.example .env
# 编辑 .env，填入 API_KEY

# 基本运行
npx tsx src/main.ts

# 自动批准（跳过确认）
npx tsx src/main.ts --auto-approve

# 查看帮助
npx tsx src/main.ts --help
```

## 与 lessons/ 的关系

- `lessons/ch01-ch08/` — 分章节教学版，每章独立可运行，递进学习
- `lessons/ch09-final/` — Ch9 整合打包版（与本目录内容完全相同）
- `complete/` — 完整版，直接从 `lessons/ch09-final/src/` 复制，方便独立使用
