/**
 * Shared IPC type definitions for OpenCode session communication.
 *
 * These types are used by both the Electron main process and the renderer
 * process (via the preload bridge). All channel names follow the
 * `namespace:kebab-case` convention. All payloads use camelCase fields.
 */

// ---------------------------------------------------------------------------
// IPC Channel Names
// ---------------------------------------------------------------------------

/**
 * Request/response channels (renderer -> main via ipcRenderer.invoke).
 */
export const OpenCodeInvokeChannel = {
  CreateSession: 'opencode:create-session',
  SendPrompt: 'opencode:send-prompt',
  ApprovePermission: 'opencode:approve-permission',
  AnswerQuestion: 'opencode:answer-question',
} as const;

export type OpenCodeInvokeChannel =
  (typeof OpenCodeInvokeChannel)[keyof typeof OpenCodeInvokeChannel];

/**
 * Event channels (main -> renderer via webContents.send / ipcRenderer.on).
 */
export const OpenCodeEventChannel = {
  SessionCreated: 'opencode:session-created',
  SessionStatus: 'opencode:session-status',
  MessageUpdated: 'opencode:message-updated',
  PartUpdated: 'opencode:part-updated',
  PermissionAsked: 'opencode:permission-asked',
  QuestionAsked: 'opencode:question-asked',
  Error: 'opencode:error',
} as const;

export type OpenCodeEventChannel =
  (typeof OpenCodeEventChannel)[keyof typeof OpenCodeEventChannel];

// ---------------------------------------------------------------------------
// Message Part Types (aligned with OpenCode SDK)
// ---------------------------------------------------------------------------

export interface TextPart {
  type: 'text';
  text: string;
}

export interface ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  result: unknown;
}

export type MessagePart = TextPart | ToolCallPart | ToolResultPart;

// ---------------------------------------------------------------------------
// Request Types (renderer -> main)
// ---------------------------------------------------------------------------

export interface CreateSessionRequest {
  title: string;
  workingDir: string;
}

export interface SendPromptRequest {
  sessionId: string;
  model?: {
    providerID: string;
    modelID: string;
  };
  parts: MessagePart[];
}

export interface ApprovePermissionRequest {
  sessionId: string;
  permissionId: string;
  approved: boolean;
}

export interface AnswerQuestionRequest {
  questionId: string;
  answer: string;
}

// ---------------------------------------------------------------------------
// Response Types (main -> renderer, returned from invoke)
// ---------------------------------------------------------------------------

export interface CreateSessionResponse {
  sessionId: string;
  title: string;
}

export interface SendPromptResponse {
  success: boolean;
}

export interface ApprovePermissionResponse {
  success: boolean;
}

export interface AnswerQuestionResponse {
  success: boolean;
}

/** Returned by placeholder handlers before SDK integration. */
export interface IpcErrorResponse {
  code: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Event Payload Types (main -> renderer)
// ---------------------------------------------------------------------------

export interface SessionCreatedEvent {
  sessionId: string;
  title: string;
}

export interface SessionStatusEvent {
  sessionId: string;
  status: string;
}

export interface MessageUpdatedEvent {
  sessionId: string;
  messageId: string;
  parts: MessagePart[];
}

export interface PartUpdatedEvent {
  sessionId: string;
  messageId: string;
  partId: string;
  content: string;
}

export interface PermissionAskedEvent {
  sessionId: string;
  permissionId: string;
  tool: string;
  params: Record<string, unknown>;
}

export interface QuestionAskedEvent {
  questionId: string;
  question: string;
}

export interface OpenCodeErrorEvent {
  code: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Bridge API Interface
// ---------------------------------------------------------------------------

/**
 * The session-related portion of the `window.opencode` API exposed by the
 * preload script. This extends the existing server lifecycle API.
 */
export interface OpenCodeBridgeAPI {
  // Request/response (renderer -> main)
  createSession: (opts: CreateSessionRequest) => Promise<CreateSessionResponse>;
  sendPrompt: (opts: SendPromptRequest) => Promise<SendPromptResponse>;
  approvePermission: (
    sessionId: string,
    permissionId: string,
    approved: boolean
  ) => Promise<ApprovePermissionResponse>;
  answerQuestion: (
    questionId: string,
    answer: string
  ) => Promise<AnswerQuestionResponse>;

  // Generic event listener
  onEvent: <T>(channel: OpenCodeEventChannel, callback: (data: T) => void) => () => void;

  // Typed event listeners
  onSessionCreated: (callback: (data: SessionCreatedEvent) => void) => () => void;
  onSessionStatus: (callback: (data: SessionStatusEvent) => void) => () => void;
  onMessageUpdated: (callback: (data: MessageUpdatedEvent) => void) => () => void;
  onPartUpdated: (callback: (data: PartUpdatedEvent) => void) => () => void;
  onPermissionAsked: (callback: (data: PermissionAskedEvent) => void) => () => void;
  onQuestionAsked: (callback: (data: QuestionAskedEvent) => void) => () => void;
  onError: (callback: (data: OpenCodeErrorEvent) => void) => () => void;
}
