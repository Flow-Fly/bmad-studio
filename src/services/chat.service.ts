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
  // Ensure conversation exists in state
  let conversation = getConversation(conversationId);
  if (!conversation) {
    conversation = {
      id: conversationId,
      messages: [],
      highlights: [],
      model,
      provider,
      createdAt: Date.now(),
    };
  }

  // Add user message to conversation
  const userMessage: Message = {
    id: `msg-user-${crypto.randomUUID()}`,
    role: 'user' as const,
    content,
    timestamp: Date.now(),
  };

  setConversation({
    ...conversation,
    messages: [...conversation.messages, userMessage],
  });

  // Set streaming state (also recovers from previous error state)
  chatConnectionState.set('streaming');
  streamingConversationId.set(conversationId);

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
  try {
    wsSend(event);
  } catch (err) {
    chatConnectionState.set('idle');
    streamingConversationId.set(null);
    throw err;
  }
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
  if (!conversation) {
    console.warn(`Chat: received chat:stream-start for unknown conversation ${payload.conversation_id}`);
    return;
  }

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
  if (!conversation) {
    console.warn(`Chat: received chat:text-delta for unknown conversation ${payload.conversation_id}`);
    return;
  }

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
  if (!conversation) {
    console.warn(`Chat: received chat:thinking-delta for unknown conversation ${payload.conversation_id}`);
    return;
  }

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
  if (!conversation) {
    console.warn(`Chat: received chat:stream-end for unknown conversation ${payload.conversation_id}`);
    return;
  }

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
  // Preserve error state — backend sends stream-end after error events
  if (chatConnectionState.get() !== 'error') {
    chatConnectionState.set('idle');
  }
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
  } else {
    console.warn(`Chat: received chat:error for unknown conversation ${payload.conversation_id}`);
  }

  chatConnectionState.set('error');
  streamingConversationId.set(null);
}

/**
 * Inject context into a conversation as an invisible message.
 * The message uses role 'user' with isContext=true so it is included in LLM
 * history but not rendered in the chat UI.
 */
export function injectContext(conversationId: string, content: string, label: string): void {
  const conversation = getConversation(conversationId);
  if (!conversation) return;

  const contextMessage: Message = {
    id: `ctx-${crypto.randomUUID()}`,
    role: 'user',
    content: `[Attached Context: ${label}]\n\n${content}`,
    timestamp: Date.now(),
    isContext: true,
    contextLabel: label,
  };

  setConversation({
    ...conversation,
    messages: [...conversation.messages, contextMessage],
  });
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
