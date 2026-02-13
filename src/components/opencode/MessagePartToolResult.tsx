import type { ToolResultPart } from '../../types/message';
import { CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MessagePartToolResultProps {
  part: ToolResultPart;
}

export function MessagePartToolResult({ part }: MessagePartToolResultProps) {
  const isError = part.isError === true;

  // Format the result for display
  let formattedResult: string;
  let isJson = false;
  if (typeof part.result === 'string') {
    try {
      const parsed = JSON.parse(part.result);
      formattedResult = JSON.stringify(parsed, null, 2);
      isJson = true;
    } catch {
      formattedResult = part.result;
    }
  } else if (part.result != null) {
    formattedResult = JSON.stringify(part.result, null, 2);
    isJson = true;
  } else {
    formattedResult = '';
  }

  return (
    <div
      className={cn(
        'ml-4 rounded border p-3',
        isError
          ? 'border-status-blocked/30 bg-status-blocked/10'
          : 'border-status-complete/30 bg-status-complete/10'
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-[length:var(--text-sm)] font-medium">
        {isError ? (
          <>
            <XCircle className="h-4 w-4 text-status-blocked" />
            <span className="text-status-blocked">Tool Error</span>
          </>
        ) : (
          <>
            <CheckCircle className="h-4 w-4 text-status-complete" />
            <span className="text-status-complete">Result</span>
          </>
        )}
      </div>

      <pre
        className={cn(
          'overflow-x-auto rounded bg-surface-sunken p-2 text-[length:var(--text-xs)] text-interactive-default',
          isJson && 'font-mono'
        )}
      >
        {formattedResult}
      </pre>
    </div>
  );
}
