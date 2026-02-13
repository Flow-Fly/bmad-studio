/**
 * Message structure for OpenCode chat sessions.
 *
 * Reuses part types from ipc.ts (the canonical source) and extends
 * with renderer-only additions like ThinkingPart.
 */

import type {
  TextPart,
  ToolCallPart,
  ToolResultPart,
} from './ipc';

export type { TextPart, ToolCallPart, ToolResultPart };

export type MessageRole = 'user' | 'assistant';

export interface ThinkingPart {
  type: 'thinking';
  thinking: string;
}

export type MessagePart = TextPart | ThinkingPart | ToolCallPart | ToolResultPart;

/** A part with its stable SDK identifier for upsert operations. */
export interface IdentifiedPart {
  partId: string;
  data: MessagePart;
}

export interface Message {
  messageId: string;
  role: MessageRole;
  parts: IdentifiedPart[];
  timestamp?: string;
}
