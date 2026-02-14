import { useCallback } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { useOpenCodeStore } from '../../stores/opencode.store';

interface TimeoutWarningProps {
  /** Callback to clear the timeout warning and restart the timer. */
  waitLonger: () => void;
}

/**
 * Inline timeout warning displayed within the chat message area when
 * a session has been busy for longer than the configured timeout.
 *
 * Provides "Wait Longer" (extends timeout) and "End Session" actions.
 *
 * This component is controlled by the parent -- it renders only when
 * `sessionTimeout` is true (caller handles conditional rendering).
 */
export function TimeoutWarning({ waitLonger }: TimeoutWarningProps) {
  const handleEndSession = useCallback(() => {
    useOpenCodeStore.getState().clearActiveSession();
  }, []);

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-[var(--radius-md)] border p-3',
        'border-status-warning/20 bg-status-warning/10',
      )}
      role="alert"
    >
      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />

      <div className="flex-1 min-w-0">
        <p className="text-[length:var(--text-sm)] text-status-warning">
          Session may have stalled. No response received for an extended period.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm" onClick={waitLonger}>
          Wait Longer
        </Button>
        <Button variant="destructive" size="sm" onClick={handleEndSession}>
          End Session
        </Button>
      </div>
    </div>
  );
}
