import { send as wsSend, on as wsOn } from './websocket.service.js';
import {
  CHAT_SEND,
  CHAT_CANCEL,
  CHAT_STREAM_START,
  CHAT_TEXT_DELTA,
  CHAT_THINKING_DELTA,
  CHAT_STREAM_END,
  CHAT_ERROR,
} from '../types/conversation.js';
import type {
  ChatStreamStartPayload,
  ChatTextDeltaPayload,
  ChatThinkingDeltaPayload,
  ChatStreamEndPayload,
  ChatErrorPayload,
  Message,
} from '../types/conversation.js';
import {
  chatConnectionState,
  streamingConversationId,
  getConversation,
  setConversation,
} from '../state/chat.state.js';
import type { WebSocketEvent } from './websocket.service.js';

export function sendMessage(
  conversationId: string,
  content: string,
  model: string,
  provider: string,
  apiKey: string,
  systemPrompt?: string,
): void {
  const event: WebSocketEvent = {
    type: CHAT_SEND,
    payload: {
      conversation_id: conversationId,
      content,
      model,
      provider,
      system_prompt: systemPrompt,
      api_key: apiKey,
    },
    timestamp: new Date().toISOString(),
  };
  wsSend(event);
}

export function cancelStream(conversationId: string): void {
  const event: WebSocketEvent = {
    type: CHAT_CANCEL,
    payload: {
      conversation_id: conversationId,
    },
    timestamp: new Date().toISOString(),
  };
  wsSend(event);
}

function handleStreamStart(event: WebSocketEvent): void {
  const payload = event.payload as ChatStreamStartPayload;
  const conversation = getConversation(payload.conversation_id);
  if (!conversation) return;

  const assistantMessage: Message = {
    id: payload.message_id,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    isStreaming: true,
  };

  const updated = {
    ...conversation,
    messages: [...conversation.messages, assistantMessage],
  };
  setConversation(updated);
  chatConnectionState.set('streaming');
  streamingConversationId.set(payload.conversation_id);
}

function handleTextDelta(event: WebSocketEvent): void {
  const payload = event.payload as ChatTextDeltaPayload;
  const conversation = getConversation(payload.conversation_id);
  if (!conversation) return;

  const messages = conversation.messages.map(msg =>
    msg.id === payload.message_id
      ? { ...msg, content: msg.content + payload.content }
      : msg,
  );
  setConversation({ ...conversation, messages });
}

function handleThinkingDelta(event: WebSocketEvent): void {
  const payload = event.payload as ChatThinkingDeltaPayload;
  const conversation = getConversation(payload.conversation_id);
  if (!conversation) return;

  const messages = conversation.messages.map(msg =>
    msg.id === payload.message_id
      ? { ...msg, thinkingContent: (msg.thinkingContent ?? '') + payload.content }
      : msg,
  );
  setConversation({ ...conversation, messages });
}

function handleStreamEnd(event: WebSocketEvent): void {
  const payload = event.payload as ChatStreamEndPayload;
  const conversation = getConversation(payload.conversation_id);
  if (!conversation) return;

  const messages = conversation.messages.map(msg =>
    msg.id === payload.message_id
      ? {
          ...msg,
          isStreaming: false,
          isPartial: payload.partial,
          usage: payload.usage ?? undefined,
        }
      : msg,
  );
  setConversation({ ...conversation, messages });
  chatConnectionState.set('idle');
  streamingConversationId.set(null);
}

function handleError(event: WebSocketEvent): void {
  const payload = event.payload as ChatErrorPayload;
  const conversation = getConversation(payload.conversation_id);

  if (conversation) {
    const messages = conversation.messages.map(msg =>
      msg.id === payload.message_id
        ? { ...msg, isStreaming: false, content: msg.content || `Error: ${payload.message}` }
        : msg,
    );
    setConversation({ ...conversation, messages });
  }

  chatConnectionState.set('error');
  streamingConversationId.set(null);
}

export function initChatService(): () => void {
  const cleanups = [
    wsOn(CHAT_STREAM_START, handleStreamStart),
    wsOn(CHAT_TEXT_DELTA, handleTextDelta),
    wsOn(CHAT_THINKING_DELTA, handleThinkingDelta),
    wsOn(CHAT_STREAM_END, handleStreamEnd),
    wsOn(CHAT_ERROR, handleError),
  ];

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
