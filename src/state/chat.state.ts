import { Signal } from 'signal-polyfill';
import type { Conversation, Highlight } from '../types/conversation.js';
import type { PendingToolConfirm } from '../types/tool.js';

export type ChatConnectionState = 'idle' | 'streaming' | 'error';

export const chatConnectionState = new Signal.State<ChatConnectionState>('idle');
export const activeConversations = new Signal.State<Map<string, Conversation>>(new Map());
export const streamingConversationId = new Signal.State<string | null>(null);

// Tool confirmation state
export const pendingToolConfirm = new Signal.State<PendingToolConfirm | null>(null);
export const sessionDismissedTools = new Signal.State<Set<string>>(new Set());

export function getConversation(id: string): Conversation | undefined {
  return activeConversations.get().get(id);
}

export function setConversation(conversation: Conversation): void {
  const map = new Map(activeConversations.get());
  map.set(conversation.id, conversation);
  activeConversations.set(map);
}

export function addHighlight(conversationId: string, highlight: Highlight): void {
  const map = new Map(activeConversations.get());
  const conv = map.get(conversationId);
  if (!conv) return;
  map.set(conversationId, {
    ...conv,
    highlights: [...conv.highlights, highlight],
  });
  activeConversations.set(map);
}

export function removeHighlight(conversationId: string, highlightId: string): void {
  const map = new Map(activeConversations.get());
  const conv = map.get(conversationId);
  if (!conv) return;
  map.set(conversationId, {
    ...conv,
    highlights: conv.highlights.filter(h => h.id !== highlightId),
  });
  activeConversations.set(map);
}

export function removeConversation(conversationId: string): void {
  const map = new Map(activeConversations.get());
  map.delete(conversationId);
  activeConversations.set(map);
}

export function getActiveConversationCount(): number {
  return activeConversations.get().size;
}

export function clearChatState(): void {
  chatConnectionState.set('idle');
  activeConversations.set(new Map());
  streamingConversationId.set(null);
  pendingToolConfirm.set(null);
  // Note: sessionDismissedTools intentionally NOT cleared here (session-scoped)
}

// Tool confirmation helpers
export function dismissToolForSession(toolName: string): void {
  const current = sessionDismissedTools.get();
  sessionDismissedTools.set(new Set([...current, toolName]));
}

export function isToolDismissedForSession(toolName: string): boolean {
  return sessionDismissedTools.get().has(toolName);
}

export function clearPendingConfirm(): void {
  pendingToolConfirm.set(null);
}
