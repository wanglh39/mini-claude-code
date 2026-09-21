import type Anthropic from "@anthropic-ai/sdk";
import { readTool, executeRead } from "./read.js";
import { writeTool, executeWrite } from "./write.js";
import { editTool, executeEdit } from "./edit.js";
import { bashTool, executeBash } from "./bash.js";
import { globTool, executeGlob } from "./glob.js";
import { grepTool, executeGrep } from "./grep.js";

export type Tool = Anthropic.Tool;

export const tools: Tool[] = [
  readTool,
  writeTool,
  editTool,
  bashTool,
  globTool,
  grepTool,
];

export async function executeTool(name: string, input: any): Promise<string> {
  switch (name) {
    case "read_file":
      return executeRead(input);
    case "write_file":
      return executeWrite(input);
    case "edit_file":
      return executeEdit(input);
    case "bash":
      return executeBash(input);
    case "glob":
      return executeGlob(input);
    case "grep":
      return executeGrep(input);
    default:
      return `错误: 未知工具 "${name}"`;
  }
}