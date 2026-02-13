/**
 * Message structure for OpenCode chat sessions.
 *
 * These types represent the conversation history managed by the opencode.store.
 * They align with the OpenCode SDK's message format and are updated via IPC
 * events from the Electron main process.
 */

// Message role (user or assistant)
export type MessageRole = 'user' | 'assistant';

// Individual part types within a message
export interface TextPart {
  type: 'text';
  text: string;
}

export interface ThinkingPart {
  type: 'thinking';
  thinking: string;
}

export interface ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  result: unknown;
  isError?: boolean;
}

// Union of all message part types
export type MessagePart = TextPart | ThinkingPart | ToolCallPart | ToolResultPart;

// Full message structure
export interface Message {
  messageId: string;
  role: MessageRole;
  parts: MessagePart[];
  timestamp?: string;
}
