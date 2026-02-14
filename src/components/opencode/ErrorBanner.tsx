import { useCallback } from 'react';
import { AlertCircle, X, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import {
  useSessionError,
  useLastUserPrompt,
  useRetrying,
  useActiveSession,
  useOpenCodeStore,
} from '../../stores/opencode.store';
import { retryLastPrompt } from '../../services/opencode.service';

/**
 * Inline error banner displayed within the chat message area when
 * a session error occurs.
 *
 * Shows the error message, a Retry button (when a previous prompt
 * is available), and a Dismiss button to clear the error.
 *
 * This component is controlled entirely by store state -- it renders
 * only when `sessionError` is non-null (caller handles conditional rendering).
 */
export function ErrorBanner() {
  const sessionError = useSessionError();
  const lastUserPrompt = useLastUserPrompt();
  const retrying = useRetrying();
  const { sessionId } = useActiveSession();

  const handleRetry = useCallback(async () => {
    if (!sessionId) return;
    try {
      await retryLastPrompt(sessionId);
    } catch {
      // Error state is managed by retryLastPrompt -- no additional handling needed
    }
  }, [sessionId]);

  const handleDismiss = useCallback(() => {
    useOpenCodeStore.getState().setSessionError(null);
  }, []);

  if (!sessionError && !retrying) return null;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-[var(--radius-md)] border p-3',
        retrying && !sessionError
          ? 'border-border-primary bg-bg-tertiary'
          : 'border-status-blocked/20 bg-status-blocked/10',
      )}
      role="alert"
    >
      {retrying ? (
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary animate-spin" />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-blocked" />
      )}

      <div className="flex-1 min-w-0">
        {retrying ? (
          <p className="text-[length:var(--text-sm)] text-text-secondary">
            Retrying...
          </p>
        ) : (
          <p className="text-[length:var(--text-sm)] text-status-blocked">
            {sessionError}
          </p>
        )}
      </div>

      {!retrying && (
        <div className="flex shrink-0 items-center gap-2">
          {lastUserPrompt && (
            <Button variant="outline" size="sm" onClick={handleRetry}>
              Retry
            </Button>
          )}
          <button
            onClick={handleDismiss}
            className="rounded-[var(--radius-sm)] p-0.5 text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
            aria-label="Dismiss error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
