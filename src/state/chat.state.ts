import { Signal } from 'signal-polyfill';
import type { Conversation } from '../types/conversation.js';

export type ChatConnectionState = 'idle' | 'streaming' | 'error';

export const chatConnectionState = new Signal.State<ChatConnectionState>('idle');
export const activeConversations = new Signal.State<Map<string, Conversation>>(new Map());
export const streamingConversationId = new Signal.State<string | null>(null);

export function getConversation(id: string): Conversation | undefined {
  return activeConversations.get().get(id);
}

export function setConversation(conversation: Conversation): void {
  const map = new Map(activeConversations.get());
  map.set(conversation.id, conversation);
  activeConversations.set(map);
}

export function clearChatState(): void {
  chatConnectionState.set('idle');
  activeConversations.set(new Map());
  streamingConversationId.set(null);
}
