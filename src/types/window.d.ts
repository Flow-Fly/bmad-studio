// Electron IPC API exposed via preload

import type {
  CreateSessionRequest,
  CreateSessionResponse,
  SendPromptRequest,
  SendPromptResponse,
  ApprovePermissionResponse,
  AnswerQuestionResponse,
  OpenCodeEventChannel,
  SessionCreatedEvent,
  SessionStatusEvent,
  MessageUpdatedEvent,
  PartUpdatedEvent,
  PermissionAskedEvent,
  QuestionAskedEvent,
  OpenCodeErrorEvent,
} from './ipc';

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
  // Server lifecycle (from Epic 6)
  onServerReady: (callback: (data: { port: number }) => void) => () => void;
  onServerRestarting: (callback: (data: { retryCount: number }) => void) => () => void;
  onServerError: (callback: (data: { code: string; message: string }) => void) => () => void;
  onDetectionResult: (callback: (data: OpenCodeDetectionResult) => void) => () => void;
  onNotInstalled: (callback: () => void) => () => void;
  onNotConfigured: (callback: (data: { path: string }) => void) => () => void;
  redetect: () => Promise<OpenCodeRedetectResult>;
  getStatus: () => Promise<{
    installed: boolean;
    configured: boolean;
    serverStatus: string;
    port: number | null;
    version?: string;
    path?: string;
  }>;

  // Session operations (from Story 7.1)
  createSession: (opts: CreateSessionRequest) => Promise<CreateSessionResponse>;
  sendPrompt: (opts: SendPromptRequest) => Promise<SendPromptResponse>;
  approvePermission: (permissionId: string, approved: boolean) => Promise<ApprovePermissionResponse>;
  answerQuestion: (questionId: string, answer: string) => Promise<AnswerQuestionResponse>;

  // Generic event listener
  onEvent: <T>(channel: OpenCodeEventChannel, callback: (data: T) => void) => () => void;

  // Typed session event listeners
  onSessionCreated: (callback: (data: SessionCreatedEvent) => void) => () => void;
  onSessionStatus: (callback: (data: SessionStatusEvent) => void) => () => void;
  onMessageUpdated: (callback: (data: MessageUpdatedEvent) => void) => () => void;
  onPartUpdated: (callback: (data: PartUpdatedEvent) => void) => () => void;
  onPermissionAsked: (callback: (data: PermissionAskedEvent) => void) => () => void;
  onQuestionAsked: (callback: (data: QuestionAskedEvent) => void) => () => void;
  onError: (callback: (data: OpenCodeErrorEvent) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    sidecar: SidecarAPI;
    opencode: OpenCodeAPI;
  }
}
