import { create } from 'zustand';
import type { OpenCodeProviderConfig, OpenCodeConfigData } from '../types/window';
import type { Message, MessagePart, IdentifiedPart } from '../types/message';

export type OpenCodeServerStatus =
  | 'not-installed'
  | 'not-configured'
  | 'connecting'
  | 'ready'
  | 'restarting'
  | 'error';

export type SessionStatus = 'idle' | 'busy';

export interface PermissionRequest {
  sessionId: string;
  permissionId: string;
  tool: string;
  params: Record<string, unknown>;
}

export interface QuestionRequest {
  questionId: string;
  question: string;
}

interface OpenCodeState {
  // Server connection status
  serverStatus: OpenCodeServerStatus;
  port: number | null;
  errorMessage: string | null;
  retryCount: number;

  // Detection state
  installed: boolean;
  configured: boolean;
  opencodePath: string | null;
  opencodeVersion: string | null;
  providers: OpenCodeProviderConfig[];
  models: string[];
  defaultProvider: string | null;

  // Active session state
  activeSessionId: string | null;
  activeStreamId: string | null;
  sessionLaunching: boolean;
  sessionError: string | null;

  // Error recovery & timeout (Story 9.3)
  lastUserPrompt: string | null;
  sessionTimeout: boolean;
  retrying: boolean;

  // Message management (Story 8.1)
  messages: Message[];
  sessionStatus: SessionStatus;

  // Permission queue (Story 9.1)
  permissionQueue: PermissionRequest[];

  // Question queue (Story 9.2)
  questionQueue: QuestionRequest[];

  // Actions
  setServerReady: (port: number) => void;
  setServerRestarting: (retryCount: number) => void;
  setServerError: (message: string) => void;
  setDetectionResult: (data: {
    installed: boolean;
    path?: string;
    version?: string;
    config?: OpenCodeConfigData;
  }) => void;
  setNotInstalled: () => void;
  setNotConfigured: (path: string) => void;
  redetectOpenCode: () => Promise<void>;
  setActiveSession: (sessionId: string, streamId: string) => void;
  clearActiveSession: () => void;
  setSessionLaunching: (launching: boolean) => void;
  setSessionError: (error: string | null) => void;

  // Error recovery & timeout actions (Story 9.3)
  setLastUserPrompt: (prompt: string | null) => void;
  setSessionTimeout: (timeout: boolean) => void;
  setRetrying: (retrying: boolean) => void;

  // Message management actions (Story 8.1)
  upsertMessage: (message: Message) => void;
  upsertPart: (messageId: string, partId: string, partData: MessagePart) => void;
  setSessionStatus: (status: SessionStatus) => void;
  clearMessages: () => void;

  // Permission queue actions (Story 9.1)
  enqueuePermission: (request: PermissionRequest) => void;
  dequeuePermission: () => void;

  // Question queue actions (Story 9.2)
  enqueueQuestion: (request: QuestionRequest) => void;
  dequeueQuestion: () => void;
}

export const useOpenCodeStore = create<OpenCodeState>((set) => ({
  // Server connection status
  serverStatus: 'not-installed',
  port: null,
  errorMessage: null,
  retryCount: 0,

  // Detection state
  installed: false,
  configured: false,
  opencodePath: null,
  opencodeVersion: null,
  providers: [],
  models: [],
  defaultProvider: null,

  // Active session state
  activeSessionId: null,
  activeStreamId: null,
  sessionLaunching: false,
  sessionError: null,

  // Error recovery & timeout (Story 9.3)
  lastUserPrompt: null,
  sessionTimeout: false,
  retrying: false,

  // Message management (Story 8.1)
  messages: [],
  sessionStatus: 'idle',

  // Permission queue (Story 9.1)
  permissionQueue: [],

  // Question queue (Story 9.2)
  questionQueue: [],

  setServerReady: (port: number) =>
    set({
      serverStatus: 'ready',
      port,
      errorMessage: null,
      retryCount: 0,
    }),

  setServerRestarting: (retryCount: number) =>
    set({
      serverStatus: 'restarting',
      retryCount,
      errorMessage: null,
    }),

  setServerError: (message: string) =>
    set({
      serverStatus: 'error',
      errorMessage: message,
      port: null,
    }),

  setDetectionResult: (data) => {
    let serverStatus: OpenCodeServerStatus = 'not-installed';
    if (data.installed && data.config) {
      serverStatus = 'connecting';
    } else if (data.installed) {
      serverStatus = 'not-configured';
    }

    set({
      installed: data.installed,
      configured: !!data.config,
      opencodePath: data.path ?? null,
      opencodeVersion: data.version ?? null,
      providers: data.config?.providers ?? [],
      models: data.config?.models ?? [],
      defaultProvider: data.config?.defaultProvider ?? null,
      serverStatus,
    });
  },

  setNotInstalled: () =>
    set({
      installed: false,
      configured: false,
      serverStatus: 'not-installed',
      opencodePath: null,
      opencodeVersion: null,
      providers: [],
      models: [],
      defaultProvider: null,
      port: null,
      errorMessage: null,
    }),

  setNotConfigured: (path: string) =>
    set({
      installed: true,
      configured: false,
      serverStatus: 'not-configured',
      opencodePath: path,
      providers: [],
      models: [],
      defaultProvider: null,
    }),

  setActiveSession: (sessionId: string, streamId: string) =>
    set({
      activeSessionId: sessionId,
      activeStreamId: streamId,
      sessionLaunching: false,
      sessionError: null,
    }),

  clearActiveSession: () =>
    set({
      activeSessionId: null,
      activeStreamId: null,
      sessionLaunching: false,
      sessionError: null,
      lastUserPrompt: null,
      sessionTimeout: false,
      retrying: false,
      permissionQueue: [],
      questionQueue: [],
    }),

  setSessionLaunching: (launching: boolean) =>
    set({ sessionLaunching: launching }),

  setSessionError: (error: string | null) =>
    set({ sessionError: error, sessionLaunching: false }),

  // Error recovery & timeout actions (Story 9.3)
  setLastUserPrompt: (prompt: string | null) =>
    set({ lastUserPrompt: prompt }),

  setSessionTimeout: (timeout: boolean) =>
    set({ sessionTimeout: timeout }),

  setRetrying: (retrying: boolean) =>
    set({ retrying }),

  redetectOpenCode: async () => {
    try {
      const result = await window.opencode.redetect();

      if (!result.success) {
        console.error('[OpenCode Store] Re-detection failed:', result.error);
        set({
          errorMessage: result.error ?? 'Re-detection failed',
        });
        return;
      }

      // Events will trigger state updates via IPC listeners
    } catch (error) {
      console.error('[OpenCode Store] Re-detection error:', error);
      set({
        errorMessage:
          error instanceof Error ? error.message : 'Re-detection failed',
      });
    }
  },

  // Message management actions (Story 8.1)
  upsertMessage: (message: Message) =>
    set((state) => {
      const existingIndex = state.messages.findIndex(
        (m) => m.messageId === message.messageId
      );

      if (existingIndex >= 0) {
        // Replace existing message
        const newMessages = [...state.messages];
        newMessages[existingIndex] = message;
        return { messages: newMessages };
      } else {
        // Append new message
        return { messages: [...state.messages, message] };
      }
    }),

  upsertPart: (messageId: string, partId: string, partData: MessagePart) =>
    set((state) => {
      const messageIndex = state.messages.findIndex(
        (m) => m.messageId === messageId
      );

      const newPart: IdentifiedPart = { partId, data: partData };

      if (messageIndex < 0) {
        // Message doesn't exist yet — create a placeholder
        const newMessage: Message = {
          messageId,
          role: 'assistant',
          parts: [newPart],
        };
        return { messages: [...state.messages, newMessage] };
      }

      const message = state.messages[messageIndex];
      const existingPartIndex = message.parts.findIndex(
        (p) => p.partId === partId
      );

      let newParts: IdentifiedPart[];
      if (existingPartIndex >= 0) {
        // Replace existing part (immutable)
        newParts = [...message.parts];
        newParts[existingPartIndex] = newPart;
      } else {
        // Append new part
        newParts = [...message.parts, newPart];
      }

      const newMessages = [...state.messages];
      newMessages[messageIndex] = { ...message, parts: newParts };
      return { messages: newMessages };
    }),

  setSessionStatus: (status: SessionStatus) =>
    set({ sessionStatus: status, sessionTimeout: false }),

  clearMessages: () =>
    set({ messages: [], sessionStatus: 'idle' }),

  // Permission queue actions (Story 9.1)
  enqueuePermission: (request: PermissionRequest) =>
    set((state) => ({
      permissionQueue: [...state.permissionQueue, request],
    })),

  dequeuePermission: () =>
    set((state) => ({
      permissionQueue: state.permissionQueue.slice(1),
    })),

  // Question queue actions (Story 9.2)
  enqueueQuestion: (request: QuestionRequest) =>
    set((state) => ({
      questionQueue: [...state.questionQueue, request],
    })),

  dequeueQuestion: () =>
    set((state) => ({
      questionQueue: state.questionQueue.slice(1),
    })),
}));

// Initialize IPC listeners
if (typeof window !== 'undefined' && window.opencode) {
  window.opencode.onServerReady((data) => {
    console.log('[OpenCode Store] Server ready on port', data.port);
    useOpenCodeStore.getState().setServerReady(data.port);
  });

  window.opencode.onServerRestarting((data) => {
    console.log('[OpenCode Store] Server restarting, retry', data.retryCount);
    useOpenCodeStore.getState().setServerRestarting(data.retryCount);
  });

  window.opencode.onServerError((data) => {
    console.error('[OpenCode Store] Server error:', data.message);
    useOpenCodeStore.getState().setServerError(data.message);
  });

  window.opencode.onDetectionResult((data) => {
    console.log('[OpenCode Store] Detection result:', data);
    useOpenCodeStore.getState().setDetectionResult(data);
  });

  window.opencode.onNotInstalled(() => {
    console.log('[OpenCode Store] OpenCode not installed');
    useOpenCodeStore.getState().setNotInstalled();
  });

  window.opencode.onNotConfigured((data) => {
    console.log('[OpenCode Store] OpenCode not configured at', data.path);
    useOpenCodeStore.getState().setNotConfigured(data.path);
  });

  // Fetch initial status on mount
  if (window.opencode.getStatus) {
    window.opencode.getStatus().then((state) => {
      if (state) {
        console.log('[OpenCode Store] Initial status:', state);

        useOpenCodeStore.getState().setDetectionResult({
          installed: state.installed,
          config: state.configured ? { providers: [], models: [] } : undefined,
          version: state.version,
          path: state.path,
        });

        if (state.serverStatus === 'running' && state.port) {
          useOpenCodeStore.getState().setServerReady(state.port);
        }
      }
    }).catch((error) => {
      console.error('[OpenCode Store] Failed to fetch initial status:', error);
    });
  }
}

// Selectors
export const useServerReady = () =>
  useOpenCodeStore((state) => state.serverStatus === 'ready');

export const useServerError = () =>
  useOpenCodeStore((state) => ({
    hasError: state.serverStatus === 'error',
    message: state.errorMessage,
  }));

export const useOpenCodePort = () => useOpenCodeStore((state) => state.port);

export const useOpenCodeInstalled = () =>
  useOpenCodeStore((state) => state.installed);

export const useOpenCodeConfigured = () =>
  useOpenCodeStore((state) => state.configured);

export const useOpenCodeProviders = () =>
  useOpenCodeStore((state) => state.providers);

export const useActiveSession = () =>
  useOpenCodeStore((state) => ({
    sessionId: state.activeSessionId,
    streamId: state.activeStreamId,
  }));

export const useSessionLaunching = () =>
  useOpenCodeStore((state) => state.sessionLaunching);

export const useSessionError = () =>
  useOpenCodeStore((state) => state.sessionError);

export const useMessages = () =>
  useOpenCodeStore((state) => state.messages);

export const useSessionStatus = () =>
  useOpenCodeStore((state) => state.sessionStatus);

export const useCurrentPermission = () =>
  useOpenCodeStore((state) => state.permissionQueue[0] ?? null);

export const useCurrentQuestion = () =>
  useOpenCodeStore((state) => state.questionQueue[0] ?? null);

// Error recovery & timeout selectors (Story 9.3)
export const useLastUserPrompt = () =>
  useOpenCodeStore((state) => state.lastUserPrompt);

export const useSessionTimeout = () =>
  useOpenCodeStore((state) => state.sessionTimeout);

export const useRetrying = () =>
  useOpenCodeStore((state) => state.retrying);

export const useServerStatus = () =>
  useOpenCodeStore((state) => state.serverStatus);
