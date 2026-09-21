# 第七章：权限与安全

> 工具执行前的确认 gate，防止模型干坏事。

## 目标

理解权限层级、危险命令检测、确认机制和工作目录边界。

## 核心原理

### 为什么需要权限

Agent 能执行命令、写文件——这很**危险**。如果模型执行了 `rm -rf /` 怎么办？

权限系统在**工具执行前**加了一道 gate：

```
模型请求执行工具 → 权限检查 → 通过？
                            ├─ 是 → 执行
                            └─ 否 → 返回拒绝信息给模型
```

### 权限层级

```
工具分类:
  ├─ 安全工具（read_file, glob, grep）──→ 自动批准
  └─ 危险工具（write_file, edit_file, bash）─→ 需要确认

确认流程:
  1. 显示操作描述
  2. 用户 y/n
  3. 可选"本次会话后续都自动允许"（会话级 auto-approve）

特殊处理:
  bash + 危险命令模式 → 额外警告
```

### 危险命令检测

```typescript
const DANGEROUS_PATTERNS = [
  /rm\s+-rf/i,           // 递归删除
  /git\s+push\s+--force/i, // 强制推送
  /git\s+reset\s+--hard/i, // 硬重置
  /DROP\s+TABLE/i,       // 删表
  /format\s+[Cc]:/i,     // 格式化磁盘
  /mkfs/i,               // 创建文件系统
  // ...
];
```

## 代码结构

```
ch07-permission/
├── main.ts
├── tools/
├── prompts/
├── context.ts
├── permission.ts      # 权限系统
└── .env.example
```

### permission.ts — PermissionManager

```typescript
class PermissionManager {
  private autoApprove: boolean;
  private approvedTools: Set<string>;  // 会话级自动批准

  async checkTool(toolName, input): Promise<boolean> {
    if (this.autoApprove) return true;           // 全局 auto-approve
    if (SAFE_TOOLS.includes(toolName)) return true; // 安全工具
    if (this.approvedTools.has(toolName)) return true; // 会话级批准

    // 危险命令特殊处理
    if (toolName === "bash" && isDangerous(input.command)) {
      // 额外警告
    }

    // 确认
    const answer = await confirm(`即将执行: ${desc}\n允许？(y/n)`);
    return answer;
  }
}
```

### main.ts 的变化

工具执行前加了权限检查：

```typescript
if (block.type === "tool_use") {
  const allowed = await perm.checkTool(block.name, block.input);

  if (!allowed) {
    // 用户拒绝，返回拒绝信息给模型
    toolResults.push({
      type: "tool_result",
      tool_use_id: block.id,
      content: "[用户拒绝了此操作]",
    });
    continue;
  }

  // 通过权限检查，执行工具
  const result = await executeTool(block.name, block.input);
  // ...
}
```

**关键设计**：拒绝后不是崩溃，而是把"用户拒绝了此操作"作为 tool_result 返回给模型。模型会知道操作被拒绝，可以调整策略。

### AUTO_APPROVE 模式

```env
AUTO_APPROVE=true  # 跳过所有确认
```

方便但危险，适合信任的场景（如自动化测试）。

## 运行方式

```bash
cd lessons/ch07-permission
npm install
cp .env.example .env
npx tsx main.ts
```

试试：
- "创建一个 test.txt" → 会弹出确认
- "执行 ls 命令" → 会弹出确认
- "执行 rm -rf test.txt" → 危险命令警告

设置 `AUTO_APPROVE=true` 跳过所有确认。

## 与真实 Claude Code 对比

| 方面 | 本章 | Claude Code |
|------|------|-------------|
| 权限层级 | 安全/危险两类 | 细粒度规则配置 |
| 确认方式 | y/n | y/n + "始终允许" + 规则配置 |
| 危险检测 | 正则模式匹配 | 命令解析 + 模式匹配 |
| 路径边界 | 无 | 工作目录限制 |
| 拒绝处理 | 返回拒绝信息 | 同 |

## 下一章预告

现在 Agent 安全了。但有些任务太大，一个 Agent 干不完——需要 spawn 子 Agent。下一章实现子智能体编排。