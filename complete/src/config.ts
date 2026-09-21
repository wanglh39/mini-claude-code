import * as dotenv from "dotenv";

dotenv.config();

export interface Config {
  apiKey: string;
  baseURL: string | undefined;
  model: string;
  maxTokens: number;
  contextLimit: number;
  autoApprove: boolean;
  systemPrompt: string;
}

export function loadConfig(args: CLIArgs): Config {
  const apiKey = process.env.API_KEY || args.apiKey || "";
  const baseURL = process.env.BASE_URL || args.baseURL || undefined;
  const model = process.env.MODEL || args.model || "claude-sonnet-4-20250514";
  const maxTokens = parseInt(
    process.env.MAX_TOKENS || args.maxTokens?.toString() || "4096"
  );
  const contextLimit = parseInt(
    process.env.CONTEXT_LIMIT || args.contextLimit?.toString() || "200000"
  );
  const autoApprove =
    process.env.AUTO_APPROVE === "true" || args.autoApprove || false;

  if (!apiKey) {
    console.error("错误: 未配置 API_KEY");
    console.error("请在 .env 文件中设置 API_KEY，或使用 --api-key 参数");
    process.exit(1);
  }

  return {
    apiKey,
    baseURL,
    model,
    maxTokens,
    contextLimit,
    autoApprove,
    systemPrompt: "",
  };
}

export interface CLIArgs {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  maxTokens?: number;
  contextLimit?: number;
  autoApprove?: boolean;
  help?: boolean;
}