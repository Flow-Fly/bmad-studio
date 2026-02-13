import { useConnectionStore } from '../stores/connection.store';
import { useStreamStore } from '../stores/stream.store';
import type { Stream } from '../types/stream';

export interface WebSocketEvent {
  type: string;
  payload: unknown;
  timestamp: string;
}

// WebSocket payload types for stream events
interface StreamCreatedPayload {
  projectId: string;
  streamId: string;
  name: string;
}

interface StreamArchivedPayload {
  projectId: string;
  streamId: string;
  outcome: string;
}

interface StreamUpdatedPayload {
  projectId: string;
  streamId: string;
  changes: Record<string, unknown>;
}

interface StreamPhaseChangedPayload {
  projectId: string;
  streamId: string;
  phase: string;
  artifacts: string[];
}

type EventHandler = (event: WebSocketEvent) => void;

const INITIAL_BACKOFF = 1000;
const MAX_BACKOFF = 30000;
const JITTER_FACTOR = 0.2;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let backoff = INITIAL_BACKOFF;
let intentionalClose = false;

const handlers = new Map<string, Set<EventHandler>>();

function setStatus(status: import('../stores/connection.store').ConnectionStatus) {
  useConnectionStore.getState().setStatus(status);
}

function getWsUrl(): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/ws`;
}

function jitter(base: number): number {
  const range = base * JITTER_FACTOR;
  return base + (Math.random() * 2 - 1) * range;
}

export function connect(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  intentionalClose = false;
  setStatus('connecting');

  ws = new WebSocket(getWsUrl());

  ws.onopen = () => {
    setStatus('connected');
    backoff = INITIAL_BACKOFF;
  };

  ws.onmessage = (event) => {
    try {
      const data: WebSocketEvent = JSON.parse(event.data);
      const typeHandlers = handlers.get(data.type);
      if (typeHandlers) {
        for (const handler of typeHandlers) {
          handler(data);
        }
      }
    } catch {
      // Ignore malformed messages
    }
  };

  ws.onclose = () => {
    ws = null;
    setStatus('disconnected');
    if (!intentionalClose) {
      scheduleReconnect();
    }
  };

  ws.onerror = () => {
    setStatus('error');
  };
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  const delay = jitter(backoff);
  backoff = Math.min(backoff * 2, MAX_BACKOFF);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

export function disconnect(): void {
  intentionalClose = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  setStatus('disconnected');
}

export function send(event: WebSocketEvent): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('WebSocket is not connected');
  }
  ws.send(JSON.stringify(event));
}

export function on(eventType: string, handler: EventHandler): () => void {
  let handlerSet = handlers.get(eventType);
  if (!handlerSet) {
    handlerSet = new Set();
    handlers.set(eventType, handlerSet);
  }
  handlerSet.add(handler);

  const captured = handlerSet;
  return () => {
    captured.delete(handler);
    if (captured.size === 0) handlers.delete(eventType);
  };
}

/**
 * Register handlers for all stream and artifact WebSocket events.
 * Returns a cleanup function that unsubscribes all handlers.
 */
export function registerStreamEventHandlers(): () => void {
  const cleanups: (() => void)[] = [];

  // stream:created — add new stream to the store
  cleanups.push(
    on('stream:created', (event) => {
      const payload = event.payload as StreamCreatedPayload;
      const stream: Stream = {
        name: payload.name,
        project: payload.projectId,
        status: 'active',
        type: 'full',
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
      };
      useStreamStore.getState().addStream(stream);
    }),
  );

  // stream:archived — update stream status
  cleanups.push(
    on('stream:archived', (event) => {
      const payload = event.payload as StreamArchivedPayload;
      useStreamStore.getState().updateStream(payload.streamId, {
        status: 'archived',
        outcome: payload.outcome as 'merged' | 'abandoned',
      });
    }),
  );

  // stream:updated — merge changes into matching stream
  cleanups.push(
    on('stream:updated', (event) => {
      const payload = event.payload as StreamUpdatedPayload;
      useStreamStore.getState().updateStream(
        payload.streamId,
        payload.changes as Partial<Stream>,
      );
    }),
  );

  // stream:phase-changed — update stream phase
  cleanups.push(
    on('stream:phase-changed', (event) => {
      const payload = event.payload as StreamPhaseChangedPayload;
      useStreamStore.getState().updateStream(payload.streamId, {
        phase: payload.phase,
      });
    }),
  );

  // artifact:created, artifact:updated, artifact:deleted — no store update needed now
  // These events will be used by later stories (artifact viewer in Epic 10)
  cleanups.push(on('artifact:created', () => {}));
  cleanups.push(on('artifact:updated', () => {}));
  cleanups.push(on('artifact:deleted', () => {}));

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
