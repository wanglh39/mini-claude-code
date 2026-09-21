import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";
import * as dotenv from "dotenv";
import { tools, executeTool } from "./tools/index.js";
import { buildSystemPrompt } from "./prompts/system.js";
import { ContextManager } from "./context.js";

dotenv.config();

const client = new Anthropic({
  apiKey: process.env.API_KEY,
  baseURL: process.env.BASE_URL || undefined,
});

const model = process.env.MODEL || "claude-sonnet-4-20250514";
const maxTokens = parseInt(process.env.MAX_TOKENS || "4096");
const contextLimit = parseInt(process.env.CONTEXT_LIMIT || "200000");
const systemPrompt = buildSystemPrompt();

const ctx = new ContextManager(contextLimit);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log("=== Mini Claude Code - Ch6 (context management) ===");
  console.log(`模型: ${model} | 上下文限制: ${contextLimit} tokens`);
  console.log('输入 "exit" 退出\n');

  while (true) {
    const userInput = await prompt("\n> ");
    if (userInput.trim() === "exit") break;
    if (!userInput.trim()) continue;

    ctx.addMessage({ role: "user", content: userInput });

    try {
      while (true) {
        const stream = client.messages.stream({
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: ctx.getMessages(),
          tools,
        });

        const contentBlocks: any[] = [];
        const toolInputBuffers: Map<number, string> = new Map();
        let stopReason: string | null = null;
        let usage: any = null;

        for await (const event of stream) {
          switch (event.type) {
            case "message_start":
              usage = event.message.usage;
              break;
            case "content_block_start": {
              const { index, content_block } = event;
              if (content_block.type === "text") {
                contentBlocks[index] = { type: "text", text: "" };
              } else if (content_block.type === "tool_use") {
                contentBlocks[index] = {
                  type: "tool_use",
                  id: content_block.id,
                  name: content_block.name,
                  input: {},
                };
                toolInputBuffers.set(index, "");
                console.log(`\n  [工具调用] ${content_block.name}...`);
              }
              break;
            }
            case "content_block_delta": {
              const { index, delta } = event;
              if (delta.type === "text_delta") {
                process.stdout.write(delta.text);
                if (contentBlocks[index]?.type === "text") {
                  contentBlocks[index].text += delta.text;
                }
              } else if (delta.type === "input_json_delta") {
                const buf = toolInputBuffers.get(index) || "";
                toolInputBuffers.set(index, buf + delta.partial_json);
              }
              break;
            }
            case "content_block_stop": {
              const { index } = event;
              if (toolInputBuffers.has(index)) {
                const jsonStr = toolInputBuffers.get(index)!;
                try {
                  contentBlocks[index].input = JSON.parse(jsonStr);
                } catch {
                  contentBlocks[index].input = {};
                }
              }
              break;
            }
            case "message_delta":
              stopReason = event.delta.stop_reason;
              if (event.usage) {
                usage = { ...usage, ...event.usage };
              }
              break;
          }
        }

        if (usage) {
          ctx.updateUsage(usage);
        }

        ctx.addMessage({ role: "assistant", content: contentBlocks });

        ctx.truncateToolResults();

        if (ctx.isNearLimit()) {
          console.log(`\n  [警告] ${ctx.getStatus()} — 接近上下文限制`);
          const compressed = await ctx.compress(client, model);
          if (compressed) {
            console.log("  [上下文] 已压缩历史对话");
          } else {
            const { removed } = ctx.truncateHistory(10);
            if (removed > 0) {
              console.log(`  [上下文] 已截断 ${removed} 条旧消息`);
            }
          }
        }

        if (stopReason === "tool_use") {
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of contentBlocks) {
            if (block.type === "tool_use") {
              const result = await executeTool(block.name, block.input);
              const preview = result.slice(0, 200);
              console.log(`  [结果] ${preview}${result.length > 200 ? "..." : ""}`);
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: result,
              });
            }
          }
          ctx.addMessage({ role: "user", content: toolResults });
        } else {
          console.log(`\n  ${ctx.getStatus()}`);
          break;
        }
      }
    } catch (err: any) {
      console.error(`\n[错误] ${err.message}`);
    }
  }

  console.log("再见！");
  rl.close();
}

main();