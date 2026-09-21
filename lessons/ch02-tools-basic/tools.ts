import * as fs from "fs";
import * as path from "path";
import type Anthropic from "@anthropic-ai/sdk";

export type Tool = Anthropic.Tool;
export type ToolUseBlock = Anthropic.ToolUseBlock;
export type ToolResultBlockParam = Anthropic.ToolResultBlockParam;

export const tools: Tool[] = [
  {
    name: "read_file",
    description:
      "读取指定路径的文件内容。返回文件的文本内容。",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "要读取的文件路径（相对路径或绝对路径）",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "将内容写入指定路径的文件。如果文件已存在则覆盖，不存在则创建。",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "要写入的文件路径",
        },
        content: {
          type: "string",
          description: "要写入的文件内容",
        },
      },
      required: ["path", "content"],
    },
  },
];

export function executeTool(name: string, input: any): string {
  try {
    switch (name) {
      case "read_file": {
        const filePath = path.resolve(input.path);
        if (!fs.existsSync(filePath)) {
          return `错误: 文件不存在: ${input.path}`;
        }
        const content = fs.readFileSync(filePath, "utf-8");
        return content;
      }

      case "write_file": {
        const filePath = path.resolve(input.path);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, input.content, "utf-8");
        return `已成功写入文件: ${input.path} (${input.content.length} 字符)`;
      }

      default:
        return `错误: 未知工具 "${name}"`;
    }
  } catch (err: any) {
    return `错误: ${err.message}`;
  }
}