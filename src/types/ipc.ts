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
 * Event channels (main -> renderer via webContents.send / ipcRenderer.on).
 */
export const OpenCodeEventChannel = {
  SessionCreated: 'opencode:session-created',
  SessionStatus: 'opencode:session-status',
  MessageUpdated: 'opencode:message-updated',
  PartUpdated: 'opencode:part-updated',
  PermissionAsked: 'opencode:permission-asked',
  QuestionAsked: 'opencode:question-asked',
  SessionCost: 'opencode:session-cost',
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
  isError?: boolean;
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
  role: 'user' | 'assistant';
  parts: MessagePart[];
}

export interface PartUpdatedEvent {
  sessionId: string;
  messageId: string;
  partId: string;
  type: string;
  content: string;
  delta?: string;
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
  sessionId?: string;
  code: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Cost Tracking Types (Story 11.4)
// ---------------------------------------------------------------------------

/** Payload sent when an assistant message includes token/cost data. */
export interface SessionCostEvent {
  sessionId: string;
  messageId: string;
  modelId: string;
  providerId: string;
  inputTokens: number;
  outputTokens: number;
  /** Total cost in USD as reported by the SDK. */
  cost: number;
}

/** Per-message cost entry stored in the OpenCode store. */
export interface SessionCostEntry {
  sessionId: string;
  messageId: string;
  model: string;
  providerId: string;
  inputTokens: number;
  outputTokens: number;
  /** Estimated cost in USD (from SDK or calculated from pricing map). */
  estimatedCost: number | null;
  timestamp: number;
}

/** Aggregated cost summary across all session cost entries. */
export interface StreamCostSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalEstimatedCost: number | null;
  sessionCount: number;
  entries: SessionCostEntry[];
}
