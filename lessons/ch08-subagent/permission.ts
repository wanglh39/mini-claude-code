import * as readline from "readline";

const DANGEROUS_PATTERNS = [
  /rm\s+-rf/i,
  /git\s+push\s+--force/i,
  /git\s+reset\s+--hard/i,
  /DROP\s+TABLE/i,
  /DELETE\s+FROM/i,
  /format\s+[Cc]:/i,
  /mkfs/i,
  /dd\s+if=/i,
  /:\(\)\s*\{\s*:\|:&\s*\};\s*:/i,
];

const SAFE_TOOLS = ["read_file", "glob", "grep"];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function confirm(query: string): Promise<boolean> {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer.toLowerCase().startsWith("y"));
    });
  });
}

export class PermissionManager {
  private autoApprove: boolean;
  private approvedTools: Set<string> = new Set();

  constructor(autoApprove: boolean = false) {
    this.autoApprove = autoApprove;
  }

  async checkTool(toolName: string, input: any): Promise<boolean> {
    if (this.autoApprove) return true;

    if (SAFE_TOOLS.includes(toolName)) return true;

    if (this.approvedTools.has(toolName)) return true;

    if (toolName === "bash" && this.isDangerousCommand(input.command)) {
      console.log(`\n  [危险命令检测] ${input.command}`);
      const answer = await confirm(`  这看起来是一个危险命令。确定要执行吗？(yes/no): `);
      if (!answer) {
        console.log("  [已拒绝]");
        return false;
      }
      return true;
    }

    const desc = this.describeAction(toolName, input);
    const answer = await confirm(`\n  即将执行: ${desc}\n  允许？(yes/no): `);

    if (answer) {
      const always = await confirm(`  本次会话后续都自动允许 ${toolName}？(yes/no): `);
      if (always) {
        this.approvedTools.add(toolName);
      }
    }

    return answer;
  }

  private isDangerousCommand(command: string): boolean {
    return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
  }

  private describeAction(toolName: string, input: any): string {
    switch (toolName) {
      case "bash":
        return `执行命令: ${input.command}`;
      case "write_file":
        return `写入文件: ${input.path} (${input.content.length} 字符)`;
      case "edit_file":
        return `编辑文件: ${input.path}`;
      default:
        return `${toolName}(${JSON.stringify(input).slice(0, 100)})`;
    }
  }

  close(): void {
    rl.close();
  }
}

export { rl };