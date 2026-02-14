import { useEffect, useRef, useCallback } from 'react';
import {
  useOpenCodeStore,
  useSessionStatus,
  useActiveSession,
} from '../stores/opencode.store';

/** Default session timeout in milliseconds (120 seconds per NFR9). */
const SESSION_TIMEOUT_MS = 120_000;

/**
 * Hook that monitors session status and triggers a timeout warning
 * when the session has been `busy` for longer than SESSION_TIMEOUT_MS.
 *
 * Provides a `waitLonger` callback that clears the timeout warning
 * and restarts the timer for another full duration.
 *
 * Timer is automatically cleared when the session becomes idle,
 * when the session changes, or on unmount.
 */
export function useSessionTimeout() {
  const sessionStatus = useSessionStatus();
  const { sessionId } = useActiveSession();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      useOpenCodeStore.getState().setSessionTimeout(true);
    }, SESSION_TIMEOUT_MS);
  }, [clearTimer]);

  // Start timer when busy, clear when idle
  useEffect(() => {
    if (sessionStatus === 'busy' && sessionId) {
      startTimer();
    } else {
      clearTimer();
      useOpenCodeStore.getState().setSessionTimeout(false);
    }
    return clearTimer;
  }, [sessionStatus, sessionId, startTimer, clearTimer]);

  // waitLonger: clear warning and restart timer
  const waitLonger = useCallback(() => {
    useOpenCodeStore.getState().setSessionTimeout(false);
    startTimer();
  }, [startTimer]);

  return { waitLonger };
}
