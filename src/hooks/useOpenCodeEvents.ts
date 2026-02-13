import { useEffect } from 'react';
import { useOpenCodeStore } from '../stores/opencode.store';
import type {
  MessageUpdatedEvent,
  PartUpdatedEvent,
  SessionStatusEvent,
  OpenCodeErrorEvent,
} from '../types/ipc';
import type { Message } from '../types/message';

/**
 * Custom hook to subscribe to OpenCode IPC events and dispatch updates to the store.
 *
 * This hook should be used in a top-level component (e.g., App or ChatPanel)
 * to establish the event subscription lifecycle. It automatically subscribes
 * on mount and cleans up on unmount.
 *
 * Epic 8, Story 8.1 - OpenCode Store & Event Hook
 */
export function useOpenCodeEvents() {
  const { activeSessionId } = useOpenCodeStore((state) => ({
    activeSessionId: state.activeSessionId,
  }));

  useEffect(() => {
    // Only subscribe if window.opencode is available
    if (!window.opencode) {
      console.warn('[useOpenCodeEvents] window.opencode not available');
      return;
    }

    console.log('[useOpenCodeEvents] Subscribing to OpenCode events');

    // Handler for message-updated events
    const handleMessageUpdated = (payload: MessageUpdatedEvent) => {
      console.log('[useOpenCodeEvents] Message updated:', payload);

      // Convert IPC payload to Message type
      const message: Message = {
        messageId: payload.messageId,
        role: payload.role,
        parts: payload.parts,
      };

      // Upsert message in store
      useOpenCodeStore.getState().upsertMessage(message);
    };

    // Handler for part-updated events (streaming text)
    const handlePartUpdated = (payload: PartUpdatedEvent) => {
      console.log('[useOpenCodeEvents] Part updated:', payload);

      // Extract part data from payload
      const partData = {
        type: payload.type,
        ...(payload.type === 'text' && { text: payload.content }),
        ...(payload.type === 'thinking' && { thinking: payload.content }),
      };

      // Find the part index from partId (assuming partId format like "part-0", "part-1")
      const partIndex = parseInt(payload.partId.split('-')[1] || '0', 10);

      // Update specific part within the message
      useOpenCodeStore.getState().updatePart(
        payload.messageId,
        partIndex,
        partData
      );
    };

    // Handler for session-status events
    const handleSessionStatus = (payload: SessionStatusEvent) => {
      console.log('[useOpenCodeEvents] Session status:', payload);

      // Map OpenCode SDK status to our session status
      const status = payload.status === 'idle' ? 'idle' : 'busy';
      useOpenCodeStore.getState().setSessionStatus(status);
    };

    // Handler for error events
    const handleError = (payload: OpenCodeErrorEvent) => {
      console.error('[useOpenCodeEvents] Error:', payload);

      // Store error message
      useOpenCodeStore.getState().setSessionError(payload.message);

      // Set session status to idle (session cannot continue after error)
      useOpenCodeStore.getState().setSessionStatus('idle');
    };

    // Subscribe to all IPC events
    const unsubMessageUpdated = window.opencode.onMessageUpdated(handleMessageUpdated);
    const unsubPartUpdated = window.opencode.onPartUpdated(handlePartUpdated);
    const unsubSessionStatus = window.opencode.onSessionStatus(handleSessionStatus);
    const unsubError = window.opencode.onError(handleError);

    // Cleanup function - unsubscribe all events on unmount
    return () => {
      console.log('[useOpenCodeEvents] Unsubscribing from OpenCode events');
      unsubMessageUpdated();
      unsubPartUpdated();
      unsubSessionStatus();
      unsubError();
    };
  }, [activeSessionId]); // Re-subscribe when activeSessionId changes
}
