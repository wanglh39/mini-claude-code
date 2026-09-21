import * as fs from "fs";
import * as path from "path";

export const grepTool = {
  name: "grep",
  description:
    "在文件中搜索正则表达式。返回匹配的文件名、行号和内容。用于查找代码中的特定模式。",
  input_schema: {
    type: "object" as const,
    properties: {
      pattern: {
        type: "string",
        description: "正则表达式模式",
      },
      include: {
        type: "string",
        description: "文件名过滤模式，如 *.ts",
      },
      cwd: {
        type: "string",
        description: "搜索根目录，默认为当前工作目录",
      },
    },
    required: ["pattern"],
  },
};

function walkDir(dir: string, baseDir: string, results: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, baseDir, results);
    } else {
      results.push(fullPath);
    }
  }
}

export function executeGrep(input: {
  pattern: string;
  include?: string;
  cwd?: string;
}): string {
  try {
    const baseDir = path.resolve(input.cwd || process.cwd());
    const allFiles: string[] = [];
    walkDir(baseDir, baseDir, allFiles);

    const regex = new RegExp(input.pattern);
    const includeRegex = input.include
      ? new RegExp(
          input.include.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$"
        )
      : null;

    const results: string[] = [];
    let totalMatches = 0;

    for (const filePath of allFiles) {
      if (includeRegex && !includeRegex.test(path.basename(filePath))) continue;

      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          const relPath = path.relative(baseDir, filePath).replace(/\\/g, "/");
          results.push(`${relPath}:${i + 1}: ${lines[i].trim()}`);
          totalMatches++;
          if (totalMatches >= 200) break;
        }
      }
      if (totalMatches >= 200) break;
    }

    if (results.length === 0) {
      return `未找到匹配 "${input.pattern}" 的内容`;
    }
    return results.join("\n") + (totalMatches >= 200 ? "\n\n... (结果已截断)" : "");
  } catch (err: any) {
    return `错误: ${err.message}`;
  }
}