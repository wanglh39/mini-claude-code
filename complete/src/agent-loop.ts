import Anthropic from "@anthropic-ai/sdk";
import { tools, executeTool } from "./tools/index.js";
import { buildSystemPrompt } from "./prompts/system.js";
import { ContextManager } from "./context.js";
import { PermissionManager, rl } from "./permission.js";
import { taskTool, executeTask } from "./subagent.js";
import type { Config } from "./config.js";

const allTools = [...tools, taskTool];

export async function runAgentLoop(config: Config): Promise<void> {
  const client = new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  const systemPrompt = buildSystemPrompt();
  const ctx = new ContextManager(config.contextLimit);
  const perm = new PermissionManager(config.autoApprove);

  function prompt(query: string): Promise<string> {
    return new Promise((resolve) => rl.question(query, resolve));
  }

  console.log("=== Mini Claude Code ===");
  console.log(`模型: ${config.model} | 自动批准: ${config.autoApprove}`);
  console.log('输入 "exit" 退出 | "help" 查看命令\n');

  while (true) {
    const userInput = await prompt("\n> ");

    if (userInput.trim() === "exit") break;
    if (userInput.trim() === "help") {
      console.log('命令: exit(退出) | 工具: read_file, write_file, edit_file, bash, glob, grep, task');
      continue;
    }
    if (!userInput.trim()) continue;

    ctx.addMessage({ role: "user", content: userInput });

    try {
      await runInnerLoop(client, config, systemPrompt, ctx, perm);
    } catch (err: any) {
      console.error(`\n[错误] ${err.message}`);
    }
  }

  console.log("再见！");
  rl.close();
}

async function runInnerLoop(
  client: Anthropic,
  config: Config,
  systemPrompt: string,
  ctx: ContextManager,
  perm: PermissionManager
): Promise<void> {
  while (true) {
    const stream = client.messages.stream({
      model: config.model,
      max_tokens: config.maxTokens,
      system: systemPrompt,
      messages: ctx.getMessages(),
      tools: allTools,
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

    if (usage) ctx.updateUsage(usage);
    ctx.addMessage({ role: "assistant", content: contentBlocks });
    ctx.truncateToolResults();

    if (ctx.isNearLimit()) {
      console.log(`\n  [上下文] ${ctx.getStatus()} — 正在压缩...`);
      const compressed = await ctx.compress(client, config.model);
      if (!compressed) {
        const { removed } = ctx.truncateHistory(10);
        if (removed > 0) console.log(`  [上下文] 已截断 ${removed} 条旧消息`);
      }
    }

    if (stopReason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of contentBlocks) {
        if (block.type === "tool_use") {
          if (block.name === "task") {
            const result = await executeTask(
              client,
              config.model,
              config.maxTokens,
              block.input,
              perm
            );
            console.log(`  [子智能体结果] ${result.slice(0, 200)}...`);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            });
            continue;
          }

          const allowed = await perm.checkTool(block.name, block.input);
          if (!allowed) {
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: "[用户拒绝了此操作]",
            });
            continue;
          }

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
}