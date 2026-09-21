import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";
import * as dotenv from "dotenv";
import { tools, executeTool } from "./tools/index.js";

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

async function main() {
  console.log("=== Mini Claude Code - Ch4 (streaming) ===");
  console.log(`模型: ${model}`);
  console.log('输入 "exit" 退出\n');

  while (true) {
    const userInput = await prompt("\n> ");
    if (userInput.trim() === "exit") break;
    if (!userInput.trim()) continue;

    messages.push({ role: "user", content: userInput });

    try {
      while (true) {
        const stream = client.messages.stream({
          model,
          max_tokens: maxTokens,
          messages,
          tools,
        });

        const contentBlocks: any[] = [];
        const toolInputBuffers: Map<number, string> = new Map();
        let stopReason: string | null = null;

        for await (const event of stream) {
          switch (event.type) {
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
                const toolName = contentBlocks[index].name;
                const toolInput = contentBlocks[index].input;
                console.log(`  [参数] ${JSON.stringify(toolInput).slice(0, 100)}`);
              }
              break;
            }

            case "message_delta": {
              stopReason = event.delta.stop_reason;
              break;
            }
          }
        }

        messages.push({ role: "assistant", content: contentBlocks });

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

          messages.push({ role: "user", content: toolResults });
        } else {
          console.log("");
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