import type { CLIArgs } from "./config.js";

export function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--help":
      case "-h":
        args.help = true;
        break;
      case "--api-key":
        args.apiKey = argv[++i];
        break;
      case "--base-url":
        args.baseURL = argv[++i];
        break;
      case "--model":
        args.model = argv[++i];
        break;
      case "--max-tokens":
        args.maxTokens = parseInt(argv[++i]);
        break;
      case "--context-limit":
        args.contextLimit = parseInt(argv[++i]);
        break;
      case "--auto-approve":
        args.autoApprove = true;
        break;
    }
  }

  return args;
}

export function printHelp(): void {
  console.log(`
Mini Claude Code - 从零实现的 Claude Code 教学版

用法:
  npx tsx src/main.ts [选项]

选项:
  --api-key <key>        API Key (Anthropic 或 DeepSeek)
  --base-url <url>       API 基础 URL (DeepSeek: https://api.deepseek.com/anthropic)
  --model <model>        模型名称 (默认: claude-sonnet-4-20250514)
  --max-tokens <n>       最大输出 token 数 (默认: 4096)
  --context-limit <n>    上下文窗口限制 (默认: 200000)
  --auto-approve         自动批准所有操作 (跳过确认)
  --help, -h             显示帮助

环境变量 (.env):
  API_KEY                API Key
  BASE_URL               API 基础 URL
  MODEL                  模型名称
  MAX_TOKENS             最大输出 token 数
  CONTEXT_LIMIT          上下文窗口限制
  AUTO_APPROVE           自动批准 (true/false)

示例:
  npx tsx src/main.ts --model deepseek-chat --base-url https://api.deepseek.com/anthropic
  npx tsx src/main.ts --auto-approve
`);
}