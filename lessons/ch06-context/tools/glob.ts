import * as fs from "fs";
import * as path from "path";

export const globTool = {
  name: "glob",
  description:
    "按 glob 模式搜索文件。支持 ** 递归、* 单层通配。如 **/*.ts 搜索所有 TypeScript 文件。返回匹配的文件路径列表。",
  input_schema: {
    type: "object" as const,
    properties: {
      pattern: {
        type: "string",
        description: "glob 模式，如 **/*.ts 或 src/**/*.js",
      },
      cwd: {
        type: "string",
        description: "搜索的根目录，默认为当前工作目录",
      },
    },
    required: ["pattern"],
  },
};

function matchGlob(filePath: string, pattern: string): boolean {
  const regex = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "<<<GLOBSTAR>>>")
    .replace(/\*/g, "[^/]*")
    .replace(/<<<GLOBSTAR>>>/g, ".*");
  return new RegExp(`^${regex}$`).test(filePath);
}

function walkDir(dir: string, baseDir: string, results: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      walkDir(fullPath, baseDir, results);
    } else {
      results.push(relPath);
    }
  }
}

export function executeGlob(input: {
  pattern: string;
  cwd?: string;
}): string {
  try {
    const baseDir = path.resolve(input.cwd || process.cwd());
    const allFiles: string[] = [];
    walkDir(baseDir, baseDir, allFiles);

    const matched = allFiles
      .filter((f) => matchGlob(f, input.pattern))
      .sort();

    if (matched.length === 0) {
      return `未找到匹配 "${input.pattern}" 的文件`;
    }
    return matched.slice(0, 100).join("\n") + (matched.length > 100 ? `\n\n... (共 ${matched.length} 个文件，已截断)` : "");
  } catch (err: any) {
    return `错误: ${err.message}`;
  }
}