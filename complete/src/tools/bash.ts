import { exec } from "child_process";

export const bashTool = {
  name: "bash",
  description:
    "执行 shell 命令并返回 stdout + stderr。默认超时 120 秒。用于运行测试、构建、git 等命令。",
  input_schema: {
    type: "object" as const,
    properties: {
      command: {
        type: "string",
        description: "要执行的 shell 命令",
      },
      timeout: {
        type: "number",
        description: "超时时间（毫秒），默认 120000",
      },
    },
    required: ["command"],
  },
};

export function executeBash(input: {
  command: string;
  timeout?: number;
}): Promise<string> {
  return new Promise((resolve) => {
    const timeout = input.timeout || 120000;
    exec(
      input.command,
      { timeout, maxBuffer: 1024 * 1024 * 10 },
      (error, stdout, stderr) => {
        let result = "";
        if (stdout) result += stdout;
        if (stderr) result += `\n[stderr]\n${stderr}`;
        if (error) {
          result += `\n[exit code: ${error.code || 1}]`;
        }
        if (!result) result = "(无输出)";
        resolve(result);
      }
    );
  });
}