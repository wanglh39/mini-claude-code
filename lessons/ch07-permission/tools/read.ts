import * as fs from "fs";
import * as path from "path";

export const readTool = {
  name: "read_file",
  description:
    "读取指定路径的文件内容。返回文件的文本内容。如果文件很大，只返回前 2000 行。",
  input_schema: {
    type: "object" as const,
    properties: {
      path: {
        type: "string",
        description: "要读取的文件路径",
      },
    },
    required: ["path"],
  },
};

export function executeRead(input: { path: string }): string {
  try {
    const filePath = path.resolve(input.path);
    if (!fs.existsSync(filePath)) {
      return `错误: 文件不存在: ${input.path}`;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    if (lines.length > 2000) {
      return lines.slice(0, 2000).join("\n") + `\n\n... (共 ${lines.length} 行，已截断显示前 2000 行)`;
    }
    return content;
  } catch (err: any) {
    return `错误: ${err.message}`;
  }
}