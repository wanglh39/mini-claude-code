import type Anthropic from "@anthropic-ai/sdk";

type MessageParam = Anthropic.MessageParam;

export class ContextManager {
  private messages: MessageParam[] = [];
  private maxTokens: number;
  private lastUsage: { input_tokens: number; output_tokens: number } = {
    input_tokens: 0,
    output_tokens: 0,
  };

  constructor(maxTokens: number = 200000) {
    this.maxTokens = maxTokens;
  }

  addMessage(msg: MessageParam): void {
    this.messages.push(msg);
  }

  getMessages(): MessageParam[] {
    return this.messages;
  }

  updateUsage(usage: { input_tokens: number; output_tokens: number }): void {
    this.lastUsage = usage;
  }

  getTokenCount(): number {
    return this.lastUsage.input_tokens + this.lastUsage.output_tokens;
  }

  getInputTokenCount(): number {
    return this.lastUsage.input_tokens;
  }

  isNearLimit(): boolean {
    return this.getInputTokenCount() > this.maxTokens * 0.8;
  }

  isOverLimit(): boolean {
    return this.getInputTokenCount() > this.maxTokens * 0.95;
  }

  getStatus(): string {
    const tokens = this.getInputTokenCount();
    const pct = ((tokens / this.maxTokens) * 100).toFixed(1);
    return `[上下文] ${tokens} / ${this.maxTokens} tokens (${pct}%)`;
  }

  truncateToolResults(maxResultLength: number = 10000): void {
    for (const msg of this.messages) {
      if (msg.role === "user" && Array.isArray(msg.content)) {
        for (const block of msg.content as any[]) {
          if (
            block.type === "tool_result" &&
            typeof block.content === "string" &&
            block.content.length > maxResultLength
          ) {
            const head = block.content.slice(0, maxResultLength / 2);
            const tail = block.content.slice(-maxResultLength / 2);
            const originalLen = block.content.length;
            block.content =
              head +
              `\n\n... (已截断，原始 ${originalLen} 字符，省略中间部分) ...\n\n` +
              tail;
          }
        }
      }
    }
  }

  truncateHistory(keepRecent: number = 10): { truncated: boolean; removed: number } {
    if (this.messages.length <= keepRecent) {
      return { truncated: false, removed: 0 };
    }

    const removed = this.messages.length - keepRecent;
    this.messages = this.messages.slice(-keepRecent);
    return { truncated: true, removed };
  }

  async compress(client: Anthropic, model: string): Promise<boolean> {
    if (this.messages.length < 8) return false;

    const toCompress = this.messages.slice(0, -4);
    const recent = this.messages.slice(-4);

    const summaryMessages: MessageParam[] = [
      {
        role: "user",
        content: `请简要总结以下对话的关键信息，保留重要的上下文和决策：

${JSON.stringify(toCompress.map((m) => ({ role: m.role, content: m.content })))}

请用简洁的中文总结：`,
      },
    ];

    try {
      const response = await client.messages.create({
        model,
        max_tokens: 1024,
        messages: summaryMessages,
      });

      const summary = (response.content as Anthropic.TextBlock[])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");

      this.messages = [
        {
          role: "user",
          content: `[之前的对话总结]\n${summary}`,
        },
        {
          role: "assistant",
          content: "好的，我已了解之前的对话内容。请继续。",
        },
        ...recent,
      ];

      return true;
    } catch {
      return false;
    }
  }
}