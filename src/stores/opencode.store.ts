import { create } from 'zustand';
import type { OpenCodeProviderConfig, OpenCodeConfigData } from '../types/window';

export type OpenCodeServerStatus =
  | 'not-installed'
  | 'not-configured'
  | 'connecting'
  | 'ready'
  | 'restarting'
  | 'error';

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

  setDetectionResult: (data) =>
    set({
      installed: data.installed,
      configured: !!data.config,
      opencodePath: data.path || null,
      opencodeVersion: data.version || null,
      providers: data.config?.providers || [],
      models: data.config?.models || [],
      defaultProvider: data.config?.defaultProvider || null,
      serverStatus: data.installed
        ? data.config
          ? 'connecting'
          : 'not-configured'
        : 'not-installed',
    }),

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

  redetectOpenCode: async () => {
    try {
      const result = await window.opencode.redetect();

      if (!result.success) {
        console.error('[OpenCode Store] Re-detection failed:', result.error);
        set({
          errorMessage: result.error || 'Re-detection failed',
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
