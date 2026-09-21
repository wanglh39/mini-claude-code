import Anthropic from "@anthropic-ai/sdk";
import { tools, executeTool, type Tool } from "./tools/index.js";
import { PermissionManager } from "./permission.js";

type MessageParam = Anthropic.MessageParam;

const SUBAGENT_SYSTEM_PROMPT = `你是一个子智能体，负责完成父智能体分配的特定任务。

## 规则
- 专注于完成分配的任务，不要偏离主题
- 使用提供的工具完成任务
- 完成后用简洁的语言总结结果
- 不要执行破坏性操作`;

export const taskTool: Tool = {
  name: "task",
  description:
    "启动一个子智能体来处理子任务。子智能体有独立的上下文，不会污染主对话。适用于需要多步骤探索的复杂子任务。",
  input_schema: {
    type: "object" as const,
    properties: {
      description: {
        type: "string",
        description: "子任务的简短描述（3-5个词）",
      },
      prompt: {
        type: "string",
        description: "给子智能体的详细任务指令",
      },
    },
    required: ["description", "prompt"],
  },
};

export async function executeTask(
  client: Anthropic,
  model: string,
  maxTokens: number,
  input: { description: string; prompt: string },
  perm: PermissionManager
): Promise<string> {
  console.log(`\n  [子智能体启动] ${input.description}`);

  const subMessages: MessageParam[] = [
    { role: "user", content: input.prompt },
  ];

  const subTools = tools.filter(
    (t) => t.name !== "task"
  );

  let iteration = 0;
  const maxIterations = 20;

  while (iteration < maxIterations) {
    iteration++;

    try {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: SUBAGENT_SYSTEM_PROMPT,
        messages: subMessages,
        tools: subTools,
      });

      subMessages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "tool_use") {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type === "tool_use") {
            console.log(`    [子工具] ${block.name}`);

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
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            });
          }
        }

        subMessages.push({ role: "user", content: toolResults });
      } else {
        const text = (response.content as Anthropic.TextBlock[])
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("");

        console.log(`  [子智能体完成] ${input.description}`);
        return text || "(子智能体未返回文本)";
      }
    } catch (err: any) {
      return `子智能体错误: ${err.message}`;
    }
  }

  return `子智能体达到最大迭代次数 (${maxIterations})，强制终止`;
}