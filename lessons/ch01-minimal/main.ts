import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";
import * as dotenv from "dotenv";

dotenv.config();

const client = new Anthropic({
  apiKey: process.env.API_KEY,
  baseURL: process.env.BASE_URL || undefined,
});

const model = process.env.MODEL || "claude-sonnet-4-20250514";
const maxTokens = parseInt(process.env.MAX_TOKENS || "1024");

const messages: Anthropic.MessageParam[] = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log("=== Mini Claude Code - Ch1 (minimal) ===");
  console.log(`模型: ${model}`);
  console.log('输入 "exit" 退出\n');

  while (true) {
    const userInput = await prompt("\n> ");
    if (userInput.trim() === "exit") break;
    if (!userInput.trim()) continue;

    messages.push({ role: "user", content: userInput });

    try {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        messages,
      });

      const text = (response.content as Anthropic.TextBlock[])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");

      messages.push({ role: "assistant", content: response.content });
      console.log(text);
    } catch (err: any) {
      console.error(`[错误] ${err.message}`);
    }
  }

  console.log("再见！");
  rl.close();
}

main();