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

export interface OpenCodeProviderConfig {
  name: string;
  configured: boolean;
}

export interface OpenCodeConfigData {
  providers: OpenCodeProviderConfig[];
  models: string[];
  defaultProvider?: string;
}

export interface OpenCodeDetectionResult {
  installed: boolean;
  path?: string;
  version?: string;
  config?: OpenCodeConfigData;
}

export interface OpenCodeRedetectResult {
  success: boolean;
  installed?: boolean;
  path?: string;
  version?: string;
  config?: OpenCodeConfigData;
  error?: string;
}

export interface OpenCodeAPI {
  onServerReady: (callback: (data: { port: number }) => void) => () => void;
  onServerRestarting: (callback: (data: { retryCount: number }) => void) => () => void;
  onServerError: (callback: (data: { code: string; message: string }) => void) => () => void;
  onDetectionResult: (callback: (data: OpenCodeDetectionResult) => void) => () => void;
  onNotInstalled: (callback: () => void) => () => void;
  onNotConfigured: (callback: (data: { path: string }) => void) => () => void;
  redetect: () => Promise<OpenCodeRedetectResult>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    sidecar: SidecarAPI;
    opencode: OpenCodeAPI;
  }
}
