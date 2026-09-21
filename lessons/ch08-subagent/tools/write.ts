import * as fs from "fs";
import * as path from "path";

export const writeTool = {
  name: "write_file",
  description:
    "将内容写入指定路径的文件。如果文件已存在则覆盖，不存在则创建（含中间目录）。",
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
};

export function executeWrite(input: { path: string; content: string }): string {
  try {
    const filePath = path.resolve(input.path);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, input.content, "utf-8");
    return `已成功写入文件: ${input.path} (${input.content.length} 字符)`;
  } catch (err: any) {
    return `错误: ${err.message}`;
  }
}