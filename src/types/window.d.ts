// Electron IPC API exposed via preload

export interface ElectronAPI {
  openFolder: () => Promise<string | null>;
  getApiKey: (provider: string) => Promise<string | null>;
  setApiKey: (provider: string, key: string) => Promise<void>;
  deleteApiKey: (provider: string) => Promise<void>;
}

export interface SidecarAPI {
  onStarting: (callback: () => void) => () => void;
  onReady: (callback: (data: { port: number }) => void) => () => void;
  onRestarting: (callback: (data: { retryCount: number }) => void) => () => void;
  onError: (callback: (data: { code: string; message: string }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    sidecar: SidecarAPI;
  }
}
