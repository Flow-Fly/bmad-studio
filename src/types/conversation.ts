// Chat event type constants
export const CHAT_STREAM_START = 'chat:stream-start';
export const CHAT_TEXT_DELTA = 'chat:text-delta';
export const CHAT_THINKING_DELTA = 'chat:thinking-delta';
export const CHAT_STREAM_END = 'chat:stream-end';
export const CHAT_ERROR = 'chat:error';
export const CHAT_SEND = 'chat:send';
export const CHAT_CANCEL = 'chat:cancel';

// Server → Client payloads
export interface ChatStreamStartPayload {
  conversation_id: string;
  message_id: string;
  model: string;
}

export interface ChatTextDeltaPayload {
  conversation_id: string;
  message_id: string;
  content: string;
  index: number;
}

export interface ChatThinkingDeltaPayload {
  conversation_id: string;
  message_id: string;
  content: string;
  index: number;
}

export interface ChatStreamEndPayload {
  conversation_id: string;
  message_id: string;
  usage: UsageStats | null;
  partial: boolean;
}

export interface ChatErrorPayload {
  conversation_id: string;
  message_id: string;
  code: string;
  message: string;
}

// Client → Server payloads
export interface ChatSendPayload {
  conversation_id: string;
  content: string;
  model: string;
  provider: string;
  system_prompt?: string;
  api_key: string;
}

export interface ChatCancelPayload {
  conversation_id: string;
}

// Domain types
export interface UsageStats {
  input_tokens: number;
  output_tokens: number;
}

// Highlight types
export type HighlightColor = 'yellow' | 'green' | 'red' | 'blue';

export const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
  yellow: 'important',
  green: 'keep',
  red: 'disagree',
  blue: 'question',
};

export interface Highlight {
  id: string;
  messageId: string;
  startOffset: number;
  endOffset: number;
  color: HighlightColor;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinkingContent?: string;
  timestamp: number;
  isStreaming?: boolean;
  isPartial?: boolean;
  usage?: UsageStats;
  isContext?: boolean;
  contextLabel?: string;
}

export interface Conversation {
  id: string;
  agentId?: string;
  messages: Message[];
  highlights: Highlight[];
  createdAt: number;
  model: string;
  provider: string;
}
