import { connectionState } from '../state/connection.state.js';

export interface WebSocketEvent {
  type: string;
  payload: unknown;
  timestamp: string;
}

type EventHandler = (event: WebSocketEvent) => void;

const WS_URL = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
const INITIAL_BACKOFF = 1000;
const MAX_BACKOFF = 30000;
const JITTER_FACTOR = 0.2;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let backoff = INITIAL_BACKOFF;
let intentionalClose = false;

const handlers = new Map<string, Set<EventHandler>>();

function jitter(base: number): number {
  const range = base * JITTER_FACTOR;
  return base + (Math.random() * 2 - 1) * range;
}

export function connect(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  intentionalClose = false;
  connectionState.set('connecting');

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    connectionState.set('connected');
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
    connectionState.set('disconnected');
    if (!intentionalClose) {
      scheduleReconnect();
    }
  };

  ws.onerror = () => {
    connectionState.set('error');
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
  connectionState.set('disconnected');
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
