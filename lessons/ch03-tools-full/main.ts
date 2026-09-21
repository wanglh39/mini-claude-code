import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";
import * as dotenv from "dotenv";
import { tools, executeTool, type Tool } from "./tools/index.js";

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
  console.log("=== Mini Claude Code - Ch3 (full tools) ===");
  console.log(`模型: ${model}`);
  console.log("工具: read_file, write_file, edit_file, bash, glob, grep");
  console.log('输入 "exit" 退出\n');

  while (true) {
    const userInput = await prompt("\n> ");
    if (userInput.trim() === "exit") break;
    if (!userInput.trim()) continue;

    messages.push({ role: "user", content: userInput });

    try {
      while (true) {
        const response = await client.messages.create({
          model,
          max_tokens: maxTokens,
          messages,
          tools,
        });

        messages.push({ role: "assistant", content: response.content });

        if (response.stop_reason === "tool_use") {
          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const block of response.content) {
            if (block.type === "tool_use") {
              console.log(`\n  [工具调用] ${block.name}(${JSON.stringify(block.input).slice(0, 100)})`);

              const result = await executeTool(block.name, block.input);
              const preview = result.slice(0, 200);
              console.log(`  [工具结果] ${preview}${result.length > 200 ? "..." : ""}`);

              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: result,
              });
            }
          }

          messages.push({ role: "user", content: toolResults });
        } else {
          const text = extractText(response.content);
          if (text) console.log(text);
          break;
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