import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";
import * as dotenv from "dotenv";
import { tools, executeTool, type ToolResultBlockParam } from "./tools.js";

dotenv.config();

const client = new Anthropic({
  apiKey: process.env.API_KEY,
  baseURL: process.env.BASE_URL || undefined,
});

const model = process.env.MODEL || "claude-sonnet-4-20250514";
const maxTokens = parseInt(process.env.MAX_TOKENS || "4096");

const messages: Anthropic.MessageParam[] = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("");
}

async function main() {
  console.log("=== Mini Claude Code - Ch2 (tools: read/write) ===");
  console.log(`模型: ${model}`);
  console.log('输入 "exit" 退出\n');

  while (true) {
    const userInput = await prompt("\n> ");
    if (userInput.trim() === "exit") break;
    if (!userInput.trim()) continue;

    messages.push({ role: "user", content: userInput });

    try {
      // 内层 agentic loop — 工具调用循环
      while (true) {
        const response = await client.messages.create({
          model,
          max_tokens: maxTokens,
          messages,
          tools,
        });

        messages.push({ role: "assistant", content: response.content });

        if (response.stop_reason === "tool_use") {
          // 模型请求调用工具
          const toolResults: ToolResultBlockParam[] = [];

          for (const block of response.content) {
            if (block.type === "tool_use") {
              console.log(`\n  [工具调用] ${block.name}(${JSON.stringify(block.input)})`);

              const result = executeTool(block.name, block.input);
              console.log(`  [工具结果] ${result.slice(0, 200)}${result.length > 200 ? "..." : ""}`);

              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: result,
              });
            }
          }

          messages.push({ role: "user", content: toolResults });
          // 不 break，继续内层循环
          // 模型会看到工具结果，决定下一步
        } else {
          // stop_reason === "end_turn"，模型说完了
          const text = extractText(response.content);
          if (text) console.log(text);
          break; // 回到外层等待用户输入
        }
      }
    } catch (err: any) {
      console.error(`[错误] ${err.message}`);
    }
  }

  console.log("再见！");
  rl.close();
}

main();