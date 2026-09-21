import { execSync } from "child_process";
import * as path from "path";

export function buildSystemPrompt(): string {
  const cwd = process.cwd();
  const platform = process.platform;
  const date = new Date().toISOString().split("T")[0];
  const dirName = path.basename(cwd);

  let gitInfo = "非 Git 仓库";
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    let status = "";
    try {
      const statusOut = execSync("git status --porcelain", {
        cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "ignore"],
      }).trim();
      const changed = statusOut ? statusOut.split("\n").length : 0;
      status = changed > 0 ? `，${changed} 个未提交变更` : "，工作区干净";
    } catch {}
    gitInfo = `分支: ${branch}${status}`;
  } catch {}

  return `你是一个代码助手，帮助用户完成软件工程任务。

## 工具使用规则

你拥有以下工具：
- read_file: 读取文件内容
- write_file: 写入文件（覆盖）
- edit_file: 精确编辑文件（替换指定文本）
- bash: 执行 shell 命令
- glob: 按模式搜索文件
- grep: 搜索文件内容

使用原则：
- 读取单个文件用 read_file，搜索代码用 grep
- 修改已有文件优先用 edit_file（精确替换），新建文件用 write_file
- 执行命令前思考是否必要，避免破坏性操作
- 不要一次性读取大量文件，按需读取

## 代码风格

- 不添加多余注释（除非用户要求）
- 遵循项目现有代码风格和命名约定
- 优先使用项目已有的库，而非引入新依赖

## 安全约束

- 不执行 rm -rf 等破坏性命令
- 不修改 .git 目录下的文件
- 不提交代码（除非用户明确要求）

## 环境信息

- 工作目录: ${cwd}
- 项目名称: ${dirName}
- 操作系统: ${platform}
- 日期: ${date}
- Git: ${gitInfo}
`;
}