// Tool execution types

export type ToolStatus = 'pending' | 'running' | 'success' | 'error';
export type TrustLevel = 'supervised' | 'guided' | 'autonomous';

export interface ToolCallBlock {
  type: 'tool';
  id: string;
  toolId: string;
  toolName: string;
  input: Record<string, unknown>;
  inputRaw: string;
  status: ToolStatus;
  output?: string;
  error?: string;
  startedAt: number;
  completedAt?: number;
}

export interface PendingToolConfirm {
  conversationId: string;
  messageId: string;
  toolId: string;
  toolName: string;
  input: Record<string, unknown>;
}

export const TOOL_HINTS: Record<string, string> = {
  bash: 'Executes a shell command on your system',
  file_write: 'Creates or overwrites a file',
  file_read: 'Reads contents of a file',
  web_search: 'Searches the web for information',
};

export const DANGEROUS_TOOLS = new Set(['bash', 'file_write']);

export function isDangerousTool(toolName: string): boolean {
  return DANGEROUS_TOOLS.has(toolName);
}
