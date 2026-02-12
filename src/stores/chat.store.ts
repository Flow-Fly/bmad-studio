import { create } from 'zustand';
import type { Conversation, Highlight } from '../types/conversation';
import type { PendingToolConfirm } from '../types/tool';

export type ChatConnectionState = 'idle' | 'streaming' | 'error';

interface ChatState {
  connectionState: ChatConnectionState;
  conversations: Record<string, Conversation>;
  streamingConversationId: string | null;
  pendingToolConfirm: PendingToolConfirm | null;
  sessionDismissedTools: string[];

  // Actions
  setConnectionState: (state: ChatConnectionState) => void;
  getConversation: (id: string) => Conversation | undefined;
  setConversation: (conversation: Conversation) => void;
  addHighlight: (conversationId: string, highlight: Highlight) => void;
  removeHighlight: (conversationId: string, highlightId: string) => void;
  removeConversation: (conversationId: string) => void;
  getActiveConversationCount: () => number;
  setStreamingConversationId: (id: string | null) => void;
  setPendingToolConfirm: (confirm: PendingToolConfirm | null) => void;
  dismissToolForSession: (toolName: string) => void;
  isToolDismissedForSession: (toolName: string) => boolean;
  clearPendingConfirm: () => void;
  clearChatState: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  connectionState: 'idle',
  conversations: {},
  streamingConversationId: null,
  pendingToolConfirm: null,
  sessionDismissedTools: [],

  setConnectionState: (connectionState) => set({ connectionState }),

  getConversation: (id) => get().conversations[id],

  setConversation: (conversation) =>
    set(state => ({
      conversations: { ...state.conversations, [conversation.id]: conversation },
    })),

  addHighlight: (conversationId, highlight) =>
    set(state => {
      const conv = state.conversations[conversationId];
      if (!conv) return state;
      return {
        conversations: {
          ...state.conversations,
          [conversationId]: {
            ...conv,
            highlights: [...conv.highlights, highlight],
          },
        },
      };
    }),

  removeHighlight: (conversationId, highlightId) =>
    set(state => {
      const conv = state.conversations[conversationId];
      if (!conv) return state;
      return {
        conversations: {
          ...state.conversations,
          [conversationId]: {
            ...conv,
            highlights: conv.highlights.filter(h => h.id !== highlightId),
          },
        },
      };
    }),

  removeConversation: (conversationId) =>
    set(state => {
      const { [conversationId]: _, ...rest } = state.conversations;
      return { conversations: rest };
    }),

  getActiveConversationCount: () => Object.keys(get().conversations).length,

  setStreamingConversationId: (id) => set({ streamingConversationId: id }),

  setPendingToolConfirm: (confirm) => set({ pendingToolConfirm: confirm }),

  dismissToolForSession: (toolName) =>
    set(state => ({
      sessionDismissedTools: [...state.sessionDismissedTools, toolName],
    })),

  isToolDismissedForSession: (toolName) =>
    get().sessionDismissedTools.includes(toolName),

  clearPendingConfirm: () => set({ pendingToolConfirm: null }),

  clearChatState: () =>
    set({
      connectionState: 'idle',
      conversations: {},
      streamingConversationId: null,
      pendingToolConfirm: null,
      // Note: sessionDismissedTools intentionally NOT cleared (session-scoped)
    }),
}));
