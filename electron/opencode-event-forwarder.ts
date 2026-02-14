import type { BrowserWindow } from 'electron';
import type { OpencodeClient } from '@opencode-ai/sdk';
import type {
  Event as SdkEvent,
  EventMessageUpdated,
  EventMessagePartUpdated,
  EventSessionStatus,
  EventSessionIdle,
  EventPermissionUpdated,
  EventSessionError,
  TextPart as SdkTextPart,
} from '@opencode-ai/sdk';

import { OpenCodeEventChannel } from '../src/types/ipc';
import type {
  MessageUpdatedEvent,
  PartUpdatedEvent,
  SessionStatusEvent,
  PermissionAskedEvent,
  QuestionAskedEvent,
  OpenCodeErrorEvent,
  SessionCostEvent,
} from '../src/types/ipc';

/**
 * Bridges OpenCode SDK SSE events to the Electron renderer via IPC.
 *
 * Lifecycle:
 *   1. startForwarding(mainWindow, sdkClient) — subscribes to SSE stream
 *   2. Events are mapped from SDK types to IPC payloads and sent via webContents.send()
 *   3. stopForwarding() — tears down the SSE subscription
 *
 * This module is intentionally separate from opencode-client.ts (which handles
 * request/response SDK operations) to follow the single-responsibility pattern.
 */

/** Reference to the async generator stream for cleanup */
let activeStream: AsyncGenerator<unknown, unknown, unknown> | null = null;

/** Flag to signal the forwarding loop to stop */
let stopping = false;

/**
 * Starts SSE event subscription and forwards events to the renderer.
 *
 * @param mainWindow - The BrowserWindow to send IPC events to
 * @param sdkClient - The initialized OpenCode SDK client
 */
export async function startForwarding(
  mainWindow: BrowserWindow,
  sdkClient: OpencodeClient,
): Promise<void> {
  // Clean up any existing subscription
  await stopForwarding();
  stopping = false;

  console.log('[EventForwarder] Starting SSE event subscription');

  try {
    const result = await sdkClient.event.subscribe({
      onSseError: (error: unknown) => {
        console.error('[EventForwarder] SSE connection error:', error);
      },
    });

    activeStream = result.stream as AsyncGenerator<unknown, unknown, unknown>;

    // Process events in a non-blocking loop
    consumeEvents(mainWindow, result.stream).catch((err) => {
      if (!stopping) {
        console.error('[EventForwarder] Event consumption error:', err);
      }
    });
  } catch (error) {
    console.error('[EventForwarder] Failed to subscribe to SSE events:', error);
  }
}

/**
 * Stops the active SSE subscription and cleans up resources.
 */
export async function stopForwarding(): Promise<void> {
  stopping = true;

  if (activeStream) {
    console.log('[EventForwarder] Stopping SSE event subscription');
    try {
      await activeStream.return(undefined);
    } catch {
      // Ignore errors during cleanup
    }
    activeStream = null;
  }
}

// ---------------------------------------------------------------------------
// Internal: Event consumption loop
// ---------------------------------------------------------------------------

async function consumeEvents(
  mainWindow: BrowserWindow,
  stream: AsyncGenerator<SdkEvent, unknown, unknown>,
): Promise<void> {
  for await (const event of stream) {
    if (stopping) break;

    // Guard against destroyed window
    if (mainWindow.isDestroyed()) {
      console.warn('[EventForwarder] Window destroyed, stopping forwarding');
      break;
    }

    try {
      routeEvent(mainWindow, event);
    } catch (err) {
      console.error('[EventForwarder] Error routing event:', event.type, err);
    }
  }

  console.log('[EventForwarder] Event stream ended');
}

// ---------------------------------------------------------------------------
// Internal: Event routing
// ---------------------------------------------------------------------------

function routeEvent(mainWindow: BrowserWindow, event: SdkEvent): void {
  switch (event.type) {
    case 'message.updated':
      forwardMessageUpdated(mainWindow, event);
      break;
    case 'message.part.updated':
      forwardPartUpdated(mainWindow, event);
      break;
    case 'session.status':
      forwardSessionStatus(mainWindow, event);
      break;
    case 'session.idle':
      forwardSessionIdle(mainWindow, event);
      break;
    case 'permission.updated':
      forwardPermissionUpdated(mainWindow, event);
      break;
    case 'session.error':
      forwardSessionError(mainWindow, event);
      break;
    default:
      // The v1 SDK type union doesn't include 'question.asked', but the
      // server may still emit it.  Handle it via the untyped default path.
      forwardUnknownEvent(mainWindow, event);
      break;
  }
}

// ---------------------------------------------------------------------------
// Internal: Event mappers (SDK -> IPC payload)
// ---------------------------------------------------------------------------

function forwardMessageUpdated(
  mainWindow: BrowserWindow,
  event: EventMessageUpdated,
): void {
  const info = event.properties.info;
  const payload: MessageUpdatedEvent = {
    sessionId: info.sessionID,
    messageId: info.id,
    role: info.role,
    parts: [], // Parts are tracked via message.part.updated events
  };

  mainWindow.webContents.send(OpenCodeEventChannel.MessageUpdated, payload);

  // Forward cost data from assistant messages that have token usage
  if (info.role === 'assistant' && 'tokens' in info && info.tokens) {
    const costPayload: SessionCostEvent = {
      sessionId: info.sessionID,
      messageId: info.id,
      modelId: info.modelID,
      providerId: info.providerID,
      inputTokens: info.tokens.input,
      outputTokens: info.tokens.output,
      cost: info.cost,
    };

    mainWindow.webContents.send(OpenCodeEventChannel.SessionCost, costPayload);
  }
}

function forwardPartUpdated(
  mainWindow: BrowserWindow,
  event: EventMessagePartUpdated,
): void {
  const part = event.properties.part;

  // Extract text content based on part type
  let content = '';
  if (part.type === 'text') {
    content = (part as SdkTextPart).text ?? '';
  }

  const payload: PartUpdatedEvent = {
    sessionId: part.sessionID,
    messageId: part.messageID,
    partId: part.id,
    type: part.type,
    content,
    delta: event.properties.delta,
  };

  mainWindow.webContents.send(OpenCodeEventChannel.PartUpdated, payload);
}

function forwardSessionStatus(
  mainWindow: BrowserWindow,
  event: EventSessionStatus,
): void {
  const payload: SessionStatusEvent = {
    sessionId: event.properties.sessionID,
    status: event.properties.status.type,
  };

  mainWindow.webContents.send(OpenCodeEventChannel.SessionStatus, payload);
}

function forwardSessionIdle(
  mainWindow: BrowserWindow,
  event: EventSessionIdle,
): void {
  const payload: SessionStatusEvent = {
    sessionId: event.properties.sessionID,
    status: 'idle',
  };

  mainWindow.webContents.send(OpenCodeEventChannel.SessionStatus, payload);
}

function forwardPermissionUpdated(
  mainWindow: BrowserWindow,
  event: EventPermissionUpdated,
): void {
  const permission = event.properties;
  const payload: PermissionAskedEvent = {
    sessionId: permission.sessionID,
    permissionId: permission.id,
    tool: permission.title,
    params: permission.metadata,
  };

  mainWindow.webContents.send(OpenCodeEventChannel.PermissionAsked, payload);
}

function forwardSessionError(
  mainWindow: BrowserWindow,
  event: EventSessionError,
): void {
  const props = event.properties;
  const error = props.error;

  const payload: OpenCodeErrorEvent = {
    sessionId: props.sessionID,
    code: error?.name ?? 'UnknownError',
    message: error?.data?.message ?? 'An unknown error occurred',
  };

  mainWindow.webContents.send(OpenCodeEventChannel.Error, payload);
}

/**
 * Handles events not in the v1 SDK type union.
 * Currently supports 'question.asked' which the server may emit even though
 * the v1 SDK types don't declare it.
 */
function forwardUnknownEvent(
  mainWindow: BrowserWindow,
  event: Record<string, unknown>,
): void {
  if (event.type === 'question.asked') {
    forwardQuestionAsked(mainWindow, event);
  }
  // Other unknown event types are silently ignored
}

function forwardQuestionAsked(
  mainWindow: BrowserWindow,
  event: Record<string, unknown>,
): void {
  const props = event.properties as {
    id?: string;
    sessionID?: string;
    questions?: Array<{ question?: string }>;
  } | undefined;

  if (!props) return;

  const payload: QuestionAskedEvent = {
    questionId: props.id ?? '',
    question: props.questions?.[0]?.question ?? '',
  };

  mainWindow.webContents.send(OpenCodeEventChannel.QuestionAsked, payload);
}
