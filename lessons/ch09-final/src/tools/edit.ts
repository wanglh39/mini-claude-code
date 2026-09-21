import * as fs from "fs";
import * as path from "path";

export const editTool = {
  name: "edit_file",
  description:
    "精确编辑文件：将文件中的 oldString 替换为 newString。oldString 必须在文件中唯一匹配，否则报错。用于修改文件的特定部分，而非覆盖整个文件。",
  input_schema: {
    type: "object" as const,
    properties: {
      path: {
        type: "string",
        description: "要编辑的文件路径",
      },
      oldString: {
        type: "string",
        description: "要被替换的原始文本（必须在文件中唯一匹配）",
      },
      newString: {
        type: "string",
        description: "替换后的新文本",
      },
    },
    required: ["path", "oldString", "newString"],
  },
};

export function executeEdit(input: {
  path: string;
  oldString: string;
  newString: string;
}): string {
  try {
    const filePath = path.resolve(input.path);
    if (!fs.existsSync(filePath)) {
      return `错误: 文件不存在: ${input.path}`;
    }

    const content = fs.readFileSync(filePath, "utf-8");

    const occurrences = content.split(input.oldString).length - 1;
    if (occurrences === 0) {
      return `错误: 未找到匹配的文本。请检查 oldString 是否准确。`;
    }
    if (occurrences > 1) {
      return `错误: 找到 ${occurrences} 处匹配，oldString 不唯一。请提供更多上下文使其唯一。`;
    }

    const newContent = content.replace(input.oldString, input.newString);
    fs.writeFileSync(filePath, newContent, "utf-8");
    return `已成功编辑文件: ${input.path}`;
  } catch (err: any) {
    return `错误: ${err.message}`;
  }
}