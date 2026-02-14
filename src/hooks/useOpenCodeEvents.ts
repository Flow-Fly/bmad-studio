import { useEffect } from 'react';
import { useOpenCodeStore } from '../stores/opencode.store';
import type {
  MessageUpdatedEvent,
  PartUpdatedEvent,
  SessionStatusEvent,
  OpenCodeErrorEvent,
  PermissionAskedEvent,
  QuestionAskedEvent,
} from '../types/ipc';
import type { Message, MessagePart } from '../types/message';

/**
 * Custom hook to subscribe to OpenCode IPC events and dispatch updates to the store.
 *
 * Should be mounted once in a top-level component (e.g., App or ChatPanel).
 * Subscribes on mount and cleans up on unmount.
 */
export function useOpenCodeEvents() {
  const activeSessionId = useOpenCodeStore((state) => state.activeSessionId);

  useEffect(() => {
    if (!window.opencode) {
      console.warn('[useOpenCodeEvents] window.opencode not available');
      return;
    }

    console.log('[useOpenCodeEvents] Subscribing to OpenCode events');

    const handleMessageUpdated = (payload: MessageUpdatedEvent) => {
      console.log('[useOpenCodeEvents] Message updated:', payload);

      // Convert IPC parts to IdentifiedPart format
      const message: Message = {
        messageId: payload.messageId,
        role: payload.role,
        parts: payload.parts.map((p, i) => ({
          partId: `${payload.messageId}-${i}`,
          data: p as MessagePart,
        })),
      };

      useOpenCodeStore.getState().upsertMessage(message);
    };

    const handlePartUpdated = (payload: PartUpdatedEvent) => {
      console.log('[useOpenCodeEvents] Part updated:', payload);

      let partData: MessagePart;
      if (payload.type === 'thinking') {
        partData = { type: 'thinking', thinking: payload.content };
      } else {
        partData = { type: 'text', text: payload.content };
      }

      useOpenCodeStore.getState().upsertPart(
        payload.messageId,
        payload.partId,
        partData,
      );
    };

    const handleSessionStatus = (payload: SessionStatusEvent) => {
      console.log('[useOpenCodeEvents] Session status:', payload);
      const status = payload.status === 'idle' ? 'idle' : 'busy';
      useOpenCodeStore.getState().setSessionStatus(status);
    };

    const handleError = (payload: OpenCodeErrorEvent) => {
      console.error('[useOpenCodeEvents] Error:', payload);
      useOpenCodeStore.getState().setSessionError(payload.message);
      useOpenCodeStore.getState().setSessionStatus('idle');
    };

    const handlePermissionAsked = (payload: PermissionAskedEvent) => {
      console.log('[useOpenCodeEvents] Permission asked:', payload);
      useOpenCodeStore.getState().enqueuePermission(payload);
    };

    const handleQuestionAsked = (payload: QuestionAskedEvent) => {
      console.log('[useOpenCodeEvents] Question asked:', payload);
      useOpenCodeStore.getState().enqueueQuestion(payload);
    };

    const unsubMessageUpdated = window.opencode.onMessageUpdated(handleMessageUpdated);
    const unsubPartUpdated = window.opencode.onPartUpdated(handlePartUpdated);
    const unsubSessionStatus = window.opencode.onSessionStatus(handleSessionStatus);
    const unsubError = window.opencode.onError(handleError);
    const unsubPermission = window.opencode.onPermissionAsked(handlePermissionAsked);
    const unsubQuestion = window.opencode.onQuestionAsked(handleQuestionAsked);

    return () => {
      console.log('[useOpenCodeEvents] Unsubscribing from OpenCode events');
      unsubMessageUpdated();
      unsubPartUpdated();
      unsubSessionStatus();
      unsubError();
      unsubPermission();
      unsubQuestion();
    };
  }, [activeSessionId]);
}
