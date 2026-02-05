import { send as wsSend, on as wsOn } from './websocket.service.js';
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
} from '../types/conversation.js';
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
} from '../types/conversation.js';
import type { ToolCallBlock } from '../types/tool.js';
import { isDangerousTool } from '../types/tool.js';
import {
  chatConnectionState,
  streamingConversationId,
  getConversation,
  setConversation,
  pendingToolConfirm,
  isToolDismissedForSession,
  clearPendingConfirm,
} from '../state/chat.state.js';
import { trustLevelState } from '../state/provider.state.js';
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
    blocks: [], // Initialize empty blocks array
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

  const messages = conversation.messages.map(msg => {
    if (msg.id !== payload.message_id) return msg;

    // Update blocks array
    const blocks = msg.blocks ?? [];
    const lastBlock = blocks[blocks.length - 1];

    let updatedBlocks;
    if (lastBlock?.type === 'text') {
      // Append to existing text block
      updatedBlocks = blocks.map((b, i) =>
        i === blocks.length - 1 && b.type === 'text'
          ? { ...b, content: b.content + payload.content }
          : b,
      );
    } else {
      // Create new text block
      const newBlock: TextBlock = {
        type: 'text',
        id: `text-${payload.index}`,
        content: payload.content,
      };
      updatedBlocks = [...blocks, newBlock];
    }

    return {
      ...msg,
      content: msg.content + payload.content, // Also update legacy content for backward compat
      blocks: updatedBlocks,
    };
  });
  setConversation({ ...conversation, messages });
}

function handleThinkingDelta(event: WebSocketEvent): void {
  const payload = event.payload as ChatThinkingDeltaPayload;
  const conversation = getConversation(payload.conversation_id);
  if (!conversation) {
    console.warn(`Chat: received chat:thinking-delta for unknown conversation ${payload.conversation_id}`);
    return;
  }

  const messages = conversation.messages.map(msg => {
    if (msg.id !== payload.message_id) return msg;

    // Update blocks array
    const blocks = msg.blocks ?? [];
    const lastBlock = blocks[blocks.length - 1];

    let updatedBlocks;
    if (lastBlock?.type === 'thinking') {
      // Append to existing thinking block
      updatedBlocks = blocks.map((b, i) =>
        i === blocks.length - 1 && b.type === 'thinking'
          ? { ...b, content: b.content + payload.content }
          : b,
      );
    } else {
      // Create new thinking block
      const newBlock: ThinkingBlock = {
        type: 'thinking',
        id: `thinking-${payload.index}`,
        content: payload.content,
      };
      updatedBlocks = [...blocks, newBlock];
    }

    return {
      ...msg,
      thinkingContent: (msg.thinkingContent ?? '') + payload.content, // Also update legacy field
      blocks: updatedBlocks,
    };
  });
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

// Tool event handlers
function handleToolStart(event: WebSocketEvent): void {
  const payload = event.payload as ChatToolStartPayload;
  const conversation = getConversation(payload.conversation_id);
  if (!conversation) {
    console.warn(`Chat: received chat:tool-start for unknown conversation ${payload.conversation_id}`);
    return;
  }

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
    return {
      ...msg,
      blocks: [...(msg.blocks ?? []), toolBlock],
    };
  });
  setConversation({ ...conversation, messages });
}

function handleToolDelta(event: WebSocketEvent): void {
  const payload = event.payload as ChatToolDeltaPayload;
  const conversation = getConversation(payload.conversation_id);
  if (!conversation) return;

  const messages = conversation.messages.map(msg => {
    if (msg.id !== payload.message_id || !msg.blocks) return msg;

    const blocks = msg.blocks.map(block => {
      if (block.type !== 'tool' || block.toolId !== payload.tool_id) return block;
      return { ...block, inputRaw: block.inputRaw + payload.chunk };
    });

    return { ...msg, blocks };
  });
  setConversation({ ...conversation, messages });
}

function handleToolResult(event: WebSocketEvent): void {
  const payload = event.payload as ChatToolResultPayload;
  const conversation = getConversation(payload.conversation_id);
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
  setConversation({ ...conversation, messages });
}

function handleToolConfirm(event: WebSocketEvent): void {
  const payload = event.payload as ChatToolConfirmPayload;

  const trustLevel = trustLevelState.get();

  // Autonomous mode: auto-approve everything
  if (trustLevel === 'autonomous') {
    sendToolApprove(payload.tool_id, true);
    return;
  }

  // Check if this tool is dismissed for session
  if (isToolDismissedForSession(payload.tool_name)) {
    sendToolApprove(payload.tool_id, true);
    return;
  }

  // Guided mode: only prompt for dangerous tools
  if (trustLevel === 'guided' && !isDangerousTool(payload.tool_name)) {
    sendToolApprove(payload.tool_id, true);
    return;
  }

  // Set pending confirmation for UI (supervised mode, or dangerous tool in guided mode)
  pendingToolConfirm.set({
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
  clearPendingConfirm();
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
    // Tool event handlers
    wsOn(CHAT_TOOL_START, handleToolStart),
    wsOn(CHAT_TOOL_DELTA, handleToolDelta),
    wsOn(CHAT_TOOL_RESULT, handleToolResult),
    wsOn(CHAT_TOOL_CONFIRM, handleToolConfirm),
  ];

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
