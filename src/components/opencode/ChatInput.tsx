import { useRef, useEffect, useState } from 'react';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import { useActiveSession, useSessionStatus } from '../../stores/opencode.store';
import { sendChatMessage } from '../../services/opencode.service';

export function ChatInput() {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { sessionId } = useActiveSession();
  const sessionStatus = useSessionStatus();

  const isBusy = sessionStatus === 'busy';
  const isDisabled = !sessionId || isBusy;

  // Auto-focus when session transitions to idle or initially becomes active
  useEffect(() => {
    if (sessionStatus === 'idle' && sessionId) {
      inputRef.current?.focus();
    }
  }, [sessionStatus, sessionId]);

  const handleSubmit = async () => {
    const trimmedValue = inputValue.trim();

    if (!trimmedValue) return;

    if (!sessionId) {
      setError('No active session');
      return;
    }

    try {
      setError(null);
      await sendChatMessage(sessionId, trimmedValue);
      setInputValue('');
    } catch (err) {
      console.error('[ChatInput] Send prompt error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-surface-border p-3">
      {error && (
        <div className="mb-2 text-[length:var(--text-xs)] text-status-blocked">
          {error}
        </div>
      )}
      <Input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        placeholder={
          isBusy
            ? 'Agent is responding...'
            : sessionId
              ? 'Type a message...'
              : 'No active session'
        }
        className={cn(
          'h-10',
          isBusy && 'animate-pulse',
        )}
      />
    </div>
  );
}
