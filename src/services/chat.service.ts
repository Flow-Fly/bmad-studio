import { send as wsSend, on as wsOn } from './websocket.service';
import {
  CHAT_SEND,
  CHAT_CANCEL,
  CHAT_STREAM_START,
  CHAT_TEXT_DELTA,
  CHAT_THINKING_DELTA,
  CHAT_STREAM_END,
  CHAT_ERROR,
  CHAT_TOOL_START,
  CHAT_TOOL_DELTA,
  CHAT_TOOL_RESULT,
  CHAT_TOOL_CONFIRM,
  CHAT_TOOL_APPROVE,
} from '../types/conversation';
import type {
  ChatStreamStartPayload,
  ChatTextDeltaPayload,
  ChatThinkingDeltaPayload,
  ChatStreamEndPayload,
  ChatErrorPayload,
  ChatToolStartPayload,
  ChatToolDeltaPayload,
  ChatToolResultPayload,
  ChatToolConfirmPayload,
  Message,
  TextBlock,
  ThinkingBlock,
} from '../types/conversation';
import type { ToolCallBlock } from '../types/tool';
import { isDangerousTool } from '../types/tool';
import { useChatStore } from '../stores/chat.store';
import { useProviderStore } from '../stores/provider.store';
import type { WebSocketEvent } from './websocket.service';

function chatState() {
  return useChatStore.getState();
}

export function sendMessage(
  conversationId: string,
  content: string,
  model: string,
  provider: string,
  apiKey: string,
  systemPrompt?: string,
): void {
  const state = chatState();
  let conversation = state.getConversation(conversationId);
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

  const userMessage: Message = {
    id: `msg-user-${crypto.randomUUID()}`,
    role: 'user',
    content,
    timestamp: Date.now(),
  };

  state.setConversation({
    ...conversation,
    messages: [...conversation.messages, userMessage],
  });

  state.setConnectionState('streaming');
  state.setStreamingConversationId(conversationId);

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
    state.setConnectionState('idle');
    state.setStreamingConversationId(null);
    throw err;
  }
}

export function cancelStream(conversationId: string): void {
  const event: WebSocketEvent = {
    type: CHAT_CANCEL,
    payload: { conversation_id: conversationId },
    timestamp: new Date().toISOString(),
  };
  wsSend(event);
}

function handleStreamStart(event: WebSocketEvent): void {
  const payload = event.payload as ChatStreamStartPayload;
  const state = chatState();
  const conversation = state.getConversation(payload.conversation_id);
  if (!conversation) return;

  const assistantMessage: Message = {
    id: payload.message_id,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    isStreaming: true,
    blocks: [],
  };

  state.setConversation({
    ...conversation,
    messages: [...conversation.messages, assistantMessage],
  });
  state.setConnectionState('streaming');
  state.setStreamingConversationId(payload.conversation_id);
}

function handleTextDelta(event: WebSocketEvent): void {
  const payload = event.payload as ChatTextDeltaPayload;
  const state = chatState();
  const conversation = state.getConversation(payload.conversation_id);
  if (!conversation) return;

  const messages = conversation.messages.map(msg => {
    if (msg.id !== payload.message_id) return msg;

    const blocks = msg.blocks ?? [];
    const lastBlock = blocks[blocks.length - 1];

    let updatedBlocks;
    if (lastBlock?.type === 'text') {
      updatedBlocks = blocks.map((b, i) =>
        i === blocks.length - 1 && b.type === 'text'
          ? { ...b, content: b.content + payload.content }
          : b,
      );
    } else {
      const newBlock: TextBlock = {
        type: 'text',
        id: `text-${payload.index}`,
        content: payload.content,
      };
      updatedBlocks = [...blocks, newBlock];
    }

    return {
      ...msg,
      content: msg.content + payload.content,
      blocks: updatedBlocks,
    };
  });
  state.setConversation({ ...conversation, messages });
}

function handleThinkingDelta(event: WebSocketEvent): void {
  const payload = event.payload as ChatThinkingDeltaPayload;
  const state = chatState();
  const conversation = state.getConversation(payload.conversation_id);
  if (!conversation) return;

  const messages = conversation.messages.map(msg => {
    if (msg.id !== payload.message_id) return msg;

    const blocks = msg.blocks ?? [];
    const lastBlock = blocks[blocks.length - 1];

    let updatedBlocks;
    if (lastBlock?.type === 'thinking') {
      updatedBlocks = blocks.map((b, i) =>
        i === blocks.length - 1 && b.type === 'thinking'
          ? { ...b, content: b.content + payload.content }
          : b,
      );
    } else {
      const newBlock: ThinkingBlock = {
        type: 'thinking',
        id: `thinking-${payload.index}`,
        content: payload.content,
      };
      updatedBlocks = [...blocks, newBlock];
    }

    return {
      ...msg,
      thinkingContent: (msg.thinkingContent ?? '') + payload.content,
      blocks: updatedBlocks,
    };
  });
  state.setConversation({ ...conversation, messages });
}

function handleStreamEnd(event: WebSocketEvent): void {
  const payload = event.payload as ChatStreamEndPayload;
  const state = chatState();
  const conversation = state.getConversation(payload.conversation_id);
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
  state.setConversation({ ...conversation, messages });
  if (state.connectionState !== 'error') {
    state.setConnectionState('idle');
  }
  state.setStreamingConversationId(null);
}

function handleError(event: WebSocketEvent): void {
  const payload = event.payload as ChatErrorPayload;
  const state = chatState();
  const conversation = state.getConversation(payload.conversation_id);

  if (conversation) {
    const messages = conversation.messages.map(msg =>
      msg.id === payload.message_id
        ? { ...msg, isStreaming: false, content: msg.content || `Error: ${payload.message}` }
        : msg,
    );
    state.setConversation({ ...conversation, messages });
  }

  state.setConnectionState('error');
  state.setStreamingConversationId(null);
}

function handleToolStart(event: WebSocketEvent): void {
  const payload = event.payload as ChatToolStartPayload;
  const state = chatState();
  const conversation = state.getConversation(payload.conversation_id);
  if (!conversation) return;

  const toolBlock: ToolCallBlock = {
    type: 'tool',
    id: `block-${payload.tool_id}`,
    toolId: payload.tool_id,
    toolName: payload.tool_name,
    input: payload.input,
    inputRaw: JSON.stringify(payload.input),
    status: 'running',
    startedAt: Date.now(),
  };

  const messages = conversation.messages.map(msg => {
    if (msg.id !== payload.message_id) return msg;
    return { ...msg, blocks: [...(msg.blocks ?? []), toolBlock] };
  });
  state.setConversation({ ...conversation, messages });
}

function handleToolDelta(event: WebSocketEvent): void {
  const payload = event.payload as ChatToolDeltaPayload;
  const state = chatState();
  const conversation = state.getConversation(payload.conversation_id);
  if (!conversation) return;

  const messages = conversation.messages.map(msg => {
    if (msg.id !== payload.message_id || !msg.blocks) return msg;
    const blocks = msg.blocks.map(block => {
      if (block.type !== 'tool' || block.toolId !== payload.tool_id) return block;
      return { ...block, inputRaw: block.inputRaw + payload.chunk };
    });
    return { ...msg, blocks };
  });
  state.setConversation({ ...conversation, messages });
}

function handleToolResult(event: WebSocketEvent): void {
  const payload = event.payload as ChatToolResultPayload;
  const state = chatState();
  const conversation = state.getConversation(payload.conversation_id);
  if (!conversation) return;

  const messages = conversation.messages.map(msg => {
    if (msg.id !== payload.message_id || !msg.blocks) return msg;
    const blocks = msg.blocks.map(block => {
      if (block.type !== 'tool' || block.toolId !== payload.tool_id) return block;
      return {
        ...block,
        status: payload.status === 'success' ? 'success' : 'error',
        output: payload.status === 'success' ? payload.result : undefined,
        error: payload.status === 'error' ? payload.result : undefined,
        completedAt: Date.now(),
      } as ToolCallBlock;
    });
    return { ...msg, blocks };
  });
  state.setConversation({ ...conversation, messages });
}

function handleToolConfirm(event: WebSocketEvent): void {
  const payload = event.payload as ChatToolConfirmPayload;
  const trustLevel = useProviderStore.getState().trustLevel;

  if (trustLevel === 'autonomous') {
    sendToolApprove(payload.tool_id, true);
    return;
  }

  if (chatState().isToolDismissedForSession(payload.tool_name)) {
    sendToolApprove(payload.tool_id, true);
    return;
  }

  if (trustLevel === 'guided' && !isDangerousTool(payload.tool_name)) {
    sendToolApprove(payload.tool_id, true);
    return;
  }

  chatState().setPendingToolConfirm({
    conversationId: payload.conversation_id,
    messageId: payload.message_id,
    toolId: payload.tool_id,
    toolName: payload.tool_name,
    input: payload.input,
  });
}

export function sendToolApprove(toolId: string, approved: boolean): void {
  const event: WebSocketEvent = {
    type: CHAT_TOOL_APPROVE,
    payload: { tool_id: toolId, approved },
    timestamp: new Date().toISOString(),
  };
  wsSend(event);
  chatState().clearPendingConfirm();
}

export function injectContext(conversationId: string, content: string, label: string): void {
  const state = chatState();
  const conversation = state.getConversation(conversationId);
  if (!conversation) return;

  const contextMessage: Message = {
    id: `ctx-${crypto.randomUUID()}`,
    role: 'user',
    content: `[Attached Context: ${label}]\n\n${content}`,
    timestamp: Date.now(),
    isContext: true,
    contextLabel: label,
  };

  state.setConversation({
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
    wsOn(CHAT_TOOL_START, handleToolStart),
    wsOn(CHAT_TOOL_DELTA, handleToolDelta),
    wsOn(CHAT_TOOL_RESULT, handleToolResult),
    wsOn(CHAT_TOOL_CONFIRM, handleToolConfirm),
  ];

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
