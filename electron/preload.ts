import { contextBridge, ipcRenderer } from 'electron';

/**
 * Creates an IPC event listener that forwards data to a callback.
 * Returns a cleanup function to unsubscribe.
 */
function onIpcEvent<T = void>(
  channel: string,
  callback: (data: T) => void
): () => void {
  const listener = (_event: unknown, data: T) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openFolder'),

  getApiKey: (provider: string): Promise<string | null> =>
    ipcRenderer.invoke('keychain:get', provider),

  setApiKey: (provider: string, key: string): Promise<void> =>
    ipcRenderer.invoke('keychain:set', provider, key),

  deleteApiKey: (provider: string): Promise<void> =>
    ipcRenderer.invoke('keychain:delete', provider),
});

contextBridge.exposeInMainWorld('sidecar', {
  onStarting: (callback: () => void) =>
    onIpcEvent('sidecar:starting', callback),

  onReady: (callback: (data: { port: number }) => void) =>
    onIpcEvent('sidecar:ready', callback),

  onRestarting: (callback: (data: { retryCount: number }) => void) =>
    onIpcEvent('sidecar:restarting', callback),

  onError: (callback: (data: { code: string; message: string }) => void) =>
    onIpcEvent('sidecar:error', callback),
});

contextBridge.exposeInMainWorld('opencode', {
  // --- Server lifecycle (from Epic 6) ---

  onServerReady: (callback: (data: { port: number }) => void) =>
    onIpcEvent('opencode:server-ready', callback),

  onServerRestarting: (callback: (data: { retryCount: number }) => void) =>
    onIpcEvent('opencode:server-restarting', callback),

  onServerError: (callback: (data: { code: string; message: string }) => void) =>
    onIpcEvent('opencode:server-error', callback),

  onDetectionResult: (
    callback: (data: {
      installed: boolean;
      path?: string;
      version?: string;
      config?: {
        providers: Array<{ name: string; configured: boolean }>;
        models: string[];
        defaultProvider?: string;
      };
    }) => void
  ) => onIpcEvent('opencode:detection-result', callback),

  onNotInstalled: (callback: () => void) =>
    onIpcEvent('opencode:not-installed', callback),

  onNotConfigured: (callback: (data: { path: string }) => void) =>
    onIpcEvent('opencode:not-configured', callback),

  redetect: (): Promise<{
    success: boolean;
    installed?: boolean;
    path?: string;
    version?: string;
    config?: {
      providers: Array<{ name: string; configured: boolean }>;
      models: string[];
      defaultProvider?: string;
    };
    error?: string;
  }> => ipcRenderer.invoke('opencode:redetect'),

  getStatus: (): Promise<{
    installed: boolean;
    configured: boolean;
    serverStatus: string;
    port: number | null;
    version?: string;
    path?: string;
  }> => ipcRenderer.invoke('opencode:get-status'),

  // --- Session operations (from Story 7.1) ---

  createSession: (opts: { title: string; workingDir: string }) =>
    ipcRenderer.invoke('opencode:create-session', opts),

  sendPrompt: (opts: {
    sessionId: string;
    model?: { providerID: string; modelID: string };
    parts: Array<{ type: string; [key: string]: unknown }>;
  }) => ipcRenderer.invoke('opencode:send-prompt', opts),

  approvePermission: (sessionId: string, permissionId: string, approved: boolean) =>
    ipcRenderer.invoke('opencode:approve-permission', { sessionId, permissionId, approved }),

  answerQuestion: (questionId: string, answer: string) =>
    ipcRenderer.invoke('opencode:answer-question', { questionId, answer }),

  // --- Generic event listener ---

  onEvent: <T>(channel: string, callback: (data: T) => void): (() => void) =>
    onIpcEvent<T>(channel, callback),

  // --- Typed session event listeners ---

  onSessionCreated: (callback: (data: { sessionId: string; title: string }) => void) =>
    onIpcEvent('opencode:session-created', callback),

  onSessionStatus: (callback: (data: { sessionId: string; status: string }) => void) =>
    onIpcEvent('opencode:session-status', callback),

  onMessageUpdated: (
    callback: (data: {
      sessionId: string;
      messageId: string;
      parts: Array<{ type: string; [key: string]: unknown }>;
    }) => void
  ) => onIpcEvent('opencode:message-updated', callback),

  onPartUpdated: (
    callback: (data: {
      sessionId: string;
      messageId: string;
      partId: string;
      content: string;
    }) => void
  ) => onIpcEvent('opencode:part-updated', callback),

  onPermissionAsked: (
    callback: (data: {
      sessionId: string;
      permissionId: string;
      tool: string;
      params: Record<string, unknown>;
    }) => void
  ) => onIpcEvent('opencode:permission-asked', callback),

  onQuestionAsked: (
    callback: (data: { questionId: string; question: string }) => void
  ) => onIpcEvent('opencode:question-asked', callback),

  onError: (callback: (data: { code: string; message: string }) => void) =>
    onIpcEvent('opencode:error', callback),
});
