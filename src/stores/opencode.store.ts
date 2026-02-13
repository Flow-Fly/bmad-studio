import { create } from 'zustand';

export type OpenCodeServerStatus =
  | 'not-installed'
  | 'connecting'
  | 'ready'
  | 'restarting'
  | 'error';

interface OpenCodeState {
  serverStatus: OpenCodeServerStatus;
  port: number | null;
  errorMessage: string | null;
  retryCount: number;

  // Actions
  setServerReady: (port: number) => void;
  setServerRestarting: (retryCount: number) => void;
  setServerError: (message: string) => void;
}

export const useOpenCodeStore = create<OpenCodeState>((set) => ({
  serverStatus: 'not-installed',
  port: null,
  errorMessage: null,
  retryCount: 0,

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
}

// Selectors
export const useServerReady = () =>
  useOpenCodeStore((state) => state.serverStatus === 'ready');

export const useServerError = () =>
  useOpenCodeStore((state) => ({
    hasError: state.serverStatus === 'error',
    message: state.errorMessage,
  }));

export const useOpenCodePort = () =>
  useOpenCodeStore((state) => state.port);
