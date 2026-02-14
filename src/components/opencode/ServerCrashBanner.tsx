import { useEffect, useRef } from 'react';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useServerStatus,
  useActiveSession,
  type OpenCodeServerStatus,
} from '../../stores/opencode.store';

/**
 * Inline banner that displays server crash/recovery status during
 * an active session.
 *
 * States:
 * - `restarting`: "OpenCode restarting..." with spinner
 * - Transition from `restarting` to `ready`: "OpenCode restarted. Start a new session from the phase graph."
 * - `error` (with prior active session): "OpenCode server failed. Please restart the application."
 *
 * The banner is only visible when the server is in a crash/recovery
 * state during or after an active session. It does not show during
 * initial connection or normal operation.
 */
export function ServerCrashBanner() {
  const serverStatus = useServerStatus();
  const { sessionId } = useActiveSession();
  const prevStatusRef = useRef<OpenCodeServerStatus>(serverStatus);
  const hadActiveSessionRef = useRef(false);

  // Track whether there was an active session when the crash occurred
  useEffect(() => {
    if (sessionId) {
      hadActiveSessionRef.current = true;
    }
  }, [sessionId]);

  // Track previous server status to detect transitions
  useEffect(() => {
    prevStatusRef.current = serverStatus;
  }, [serverStatus]);

  const previousStatus = prevStatusRef.current;
  const wasRestarting = previousStatus === 'restarting';
  const isRestarting = serverStatus === 'restarting';
  const isRecovered = wasRestarting && serverStatus === 'ready';
  const isServerError = serverStatus === 'error' && hadActiveSessionRef.current;

  // Only show the banner during crash-related states
  if (!isRestarting && !isRecovered && !isServerError) {
    return null;
  }

  if (isRestarting) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-[var(--radius-md)] border p-3',
          'border-border-primary bg-bg-tertiary',
        )}
        role="status"
        aria-live="polite"
      >
        <RefreshCw className="h-4 w-4 shrink-0 text-text-secondary animate-spin" />
        <p className="text-[length:var(--text-sm)] text-text-secondary">
          OpenCode restarting...
        </p>
      </div>
    );
  }

  if (isRecovered) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-[var(--radius-md)] border p-3',
          'border-border-primary bg-bg-tertiary',
        )}
        role="status"
        aria-live="polite"
      >
        <CheckCircle className="h-4 w-4 shrink-0 text-status-active" />
        <p className="text-[length:var(--text-sm)] text-text-primary">
          OpenCode restarted. Start a new session from the phase graph.
        </p>
      </div>
    );
  }

  // isServerError
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-[var(--radius-md)] border p-3',
        'border-status-blocked/20 bg-bg-tertiary',
      )}
      role="alert"
    >
      <XCircle className="h-4 w-4 shrink-0 text-status-blocked" />
      <p className="text-[length:var(--text-sm)] text-status-blocked">
        OpenCode server failed. Please restart the application.
      </p>
    </div>
  );
}
